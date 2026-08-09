import { createHash } from 'node:crypto'
import {
  PART_SUFFIX,
  STT_MODEL_BYTES,
  STT_MODEL_FILES,
  type DownloadProgress,
  type SttModelFile,
} from '@shared/domain/dictation'

/**
 * What fetching the model needs from the world, injected so every path below is testable
 * without a network, a disk, or 640 MB of anything.
 *
 * The stream is what makes the size bearable: the encoder alone is 652 MB, and holding it in
 * memory to hash it would cost more than the download itself.
 */
export type DownloadHost = {
  /** Answers the status, the headers that matter, and the body as a stream of chunks. */
  fetch: (url: string, range: number) => Promise<DownloadResponse>
  /** How much of a partial file is already on disk. `0` when there is none. */
  sizeOf: (path: string) => Promise<number>
  /**
   * Opens a `.part` for writing — appending when `resume`, truncating otherwise — and answers
   * the handle to write through.
   *
   * A handle rather than a `write(path, chunk)`: `appendFile` opens and closes the file on
   * every call, which for the encoder alone would be sixty thousand syscalls.
   */
  open: (path: string, resume: boolean) => Promise<DownloadSink>
  /** Reads a `.part` back, in chunks, to hash what was downloaded before this run. */
  readBack: (path: string) => AsyncIterable<Uint8Array>
  remove: (path: string) => Promise<void>
  /** The atomic step. Nothing reads the final name until it holds a verified file. */
  rename: (from: string, to: string) => Promise<void>
  exists: (path: string) => Promise<boolean>
  join: (folder: string, name: string) => string
}

/** An open `.part`, for the length of one file. */
export type DownloadSink = {
  write: (chunk: Uint8Array) => Promise<void>
  close: () => Promise<void>
}

export type DownloadResponse = {
  ok: boolean
  status: number
  /** True when the server honoured the `Range` header — 206 rather than 200. */
  partial: boolean
  body: AsyncIterable<Uint8Array>
}

export type DownloadOptions = {
  folder: string
  signal?: AbortSignal
  onProgress: (progress: DownloadProgress) => void
}

/**
 * How much has to arrive before the progress is reported again.
 *
 * `net.fetch` hands out chunks of a few tens of kilobytes, so reporting each one would push
 * around twenty thousand events through the IPC for the encoder alone — every one of them
 * broadcast to every window and re-rendering a bar that can show sixty steps. The media ingest
 * has the same rule for the same reason: it reports per stage, not per byte.
 */
const PROGRESS_STEP = 4 * 1024 * 1024

/** Refused by the download itself, as opposed to a network that simply failed. */
export class ChecksumMismatch extends Error {}

export class DownloadCancelled extends Error {}

const partOf = (path: string): string => `${path}${PART_SUFFIX}`

function abortIfCancelled(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new DownloadCancelled('the model download was cancelled')
}

/**
 * Fetches one file, resuming a `.part` when there is one.
 *
 * The digest is computed as the bytes go past rather than by reading the file back at the end,
 * except for what a previous run already wrote — which has to be hashed on resume, since the
 * hash of a stream cannot be started in the middle.
 *
 * Answers how many bytes were fetched, so the caller can report progress across the whole set.
 */
export async function fetchModelFile(
  host: DownloadHost,
  file: SttModelFile,
  options: DownloadOptions & { alreadyDone: number },
): Promise<void> {
  const target = host.join(options.folder, file.name)
  const part = partOf(target)

  abortIfCancelled(options.signal)

  const onDisk = await host.sizeOf(part)
  // A `.part` at least as long as the file it claims to be is not a resume point: the URL
  // rotated, or two runs wrote at once. Starting over costs a download; trusting it would cost
  // a model that loads and recognises nothing.
  const asked = onDisk > 0 && onDisk < file.bytes ? onDisk : 0

  const response = await host.fetch(file.url, asked)
  if (!response.ok) throw new Error(`${file.name} answered ${response.status}`)

  // Resumed only if the server actually honoured the range. Asked to resume and served the
  // whole file, what is on disk is not a prefix of what is arriving — so it is dropped rather
  // than appended to, which would build a wrong file that only says so at the digest.
  const resuming = asked > 0 && response.partial
  const digest = createHash('sha256')
  let received = 0

  if (resuming) {
    for await (const chunk of host.readBack(part)) {
      abortIfCancelled(options.signal)
      digest.update(chunk)
      received += chunk.byteLength
    }
  }

  let reported = received
  const sink = await host.open(part, resuming)

  try {
    for await (const chunk of response.body) {
      abortIfCancelled(options.signal)
      await sink.write(chunk)
      digest.update(chunk)
      received += chunk.byteLength

      if (received - reported >= PROGRESS_STEP) {
        reported = received
        options.onProgress({ received: options.alreadyDone + received, total: STT_MODEL_BYTES })
      }
    }
  } finally {
    // Closed on the way out whatever happened: a cancelled download leaves a `.part` the next
    // attempt resumes from, and an open handle would keep it locked on Windows.
    await sink.close()
  }

  // The last step is almost never a whole one, and a bar that stops at 97% reads as a download
  // that stalled.
  if (received > reported) {
    options.onProgress({ received: options.alreadyDone + received, total: STT_MODEL_BYTES })
  }

  if (digest.digest('hex') !== file.sha256) {
    // Removed, not kept for a retry: a file that failed its digest has nothing worth resuming,
    // and leaving it would have the next run resume from corruption.
    await host.remove(part)
    throw new ChecksumMismatch(`${file.name} does not match its recorded digest`)
  }

  await host.rename(part, target)
}

/**
 * Fetches whatever is missing from the model folder, one file at a time.
 *
 * Sequential on purpose: four parallel streams of a 652 MB file over one connection finish no
 * sooner and make the progress bar meaningless. Progress counts bytes across the whole model,
 * not within the file being fetched — the same rule the media ingest follows.
 */
export async function fetchModel(host: DownloadHost, options: DownloadOptions): Promise<void> {
  let done = 0

  for (const file of STT_MODEL_FILES) {
    if (await host.exists(host.join(options.folder, file.name))) {
      done += file.bytes
      options.onProgress({ received: done, total: STT_MODEL_BYTES })
      continue
    }

    await fetchModelFile(host, file, { ...options, alreadyDone: done })
    done += file.bytes
  }
}

/**
 * Whether every file of the model is present. Their digests are not re-checked here: they were
 * verified before the rename, and re-reading 640 MB on every start would cost seconds of disk
 * for a file nothing else writes.
 */
export async function modelIsComplete(host: DownloadHost, folder: string): Promise<boolean> {
  for (const file of STT_MODEL_FILES) {
    if (!(await host.exists(host.join(folder, file.name)))) return false
  }
  return true
}

/**
 * Drops the leftovers of a download that never finished. Called once at startup: a `.part` is
 * only ever resumed by a download the user asked for, so one left by a crash would otherwise
 * sit there for good.
 */
export async function sweepPartials(host: DownloadHost, folder: string): Promise<void> {
  for (const file of STT_MODEL_FILES) {
    const part = partOf(host.join(folder, file.name))
    if (await host.exists(part)) await host.remove(part)
  }
}

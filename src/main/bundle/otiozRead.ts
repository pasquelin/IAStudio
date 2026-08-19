import { createReadStream, createWriteStream, type WriteStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { finished } from 'node:stream/promises'
import { Unzip, UnzipInflate, UnzipPassThrough, strFromU8 } from 'fflate'
import type { ExportWatch } from '@shared/domain/exportProgress'
import {
  isBundleEntry,
  mediaNameOf,
  OTIOZ_CONTENT_PATH,
  OTIOZ_MAJOR,
  OTIOZ_VERSION_PATH,
  otiozMajorOf,
} from '@shared/domain/otioz'

/**
 * Reading an OpenTimelineIO bundle back — the half that was missing, and the one that makes a
 * round trip through another application possible at all.
 *
 * STREAMED for the reason the writer is: `unzipSync` would hold every rush in memory at once, and
 * a montage bundle IS the rushes. The media land on disk as they arrive; only the cut is kept in
 * hand, and it is JSON.
 */

export type OtiozRead = {
  /** `content.otio`, as text. The caller parses it — this side never reads a timeline. */
  content: string
  /** Each medium that landed, by the entry the cut names and the file it became under `into`. */
  media: readonly { entry: string; file: string }[]
}

/** The ceiling the writing side already holds. A cut is JSON; a claim past this is not one. */
const MAX_CONTENT_BYTES = 64 * 1024 * 1024

/** A file that is not a bundle, or one this reader refuses. Named so the caller can say why. */
export class NotABundleError extends Error {}

/**
 * An archive naming an entry that would land outside the folder it is unpacked into.
 *
 * REFUSED WHOLE rather than skipped: an archive trying to write outside itself is hostile, and
 * unpacking the rest of it would leave somebody a montage that opened fine.
 */
export class BundleEscapeError extends Error {
  constructor(readonly entry: string) {
    super(`this bundle names an entry that would land outside it: ${entry}`)
  }
}

/** Asked to stop. Private, as the writer's is: `readOtiozFile` answers `null`. */
class ImportCancelledError extends Error {}

type Collected = { chunks: Uint8Array[]; bytes: number }

const collect = (into: Collected, chunk: Uint8Array): void => {
  into.bytes += chunk.length
  if (into.bytes > MAX_CONTENT_BYTES) throw new NotABundleError('this cut is too large to be one')
  into.chunks.push(chunk)
}

const joined = ({ chunks, bytes }: Collected): Uint8Array => {
  const all = new Uint8Array(bytes)
  let at = 0
  for (const chunk of chunks) {
    all.set(chunk, at)
    at += chunk.length
  }
  return all
}

/**
 * Unpacks the bundle into `into`, which the caller made and owns — including taking it away when
 * this answers `null` or throws. Answers `null` when it was stopped.
 */
export async function readOtiozFile(
  archive: string,
  into: string,
  { onStep, signal }: ExportWatch = {},
): Promise<OtiozRead | null> {
  if (signal?.aborted) return null

  const total = (await stat(archive)).size
  if (signal?.aborted) return null

  const version: Collected = { chunks: [], bytes: 0 }
  const content: Collected = { chunks: [], bytes: 0 }
  const media: { entry: string; file: string }[] = []
  const sinks: WriteStream[] = []

  let failure: Error | null = null
  let blocked: Promise<void> | null = null

  const unzip = new Unzip()
  // Both, explicitly: a bundle is written stored, but nothing stops another application from
  // deflating its own — and an unregistered method makes `start()` throw rather than skip.
  unzip.register(UnzipPassThrough)
  unzip.register(UnzipInflate)

  const drain = (sink: WriteStream, chunk: Uint8Array, last: boolean): void => {
    // Held so the archive stops being read while the disk catches up: without it, a fast source
    // and a slow destination keep the difference in memory, which here is a rush.
    const full = !sink.write(chunk)
    if (last) sink.end()
    // An ended stream never emits `drain`, so the flush is what a full buffer waits on there — a
    // `drain` listener armed on the last chunk of a rush is one nothing ever fires. Its rejection
    // is dropped: the listener below has already named the fault, and `room` throws it.
    if (full) {
      blocked = last
        ? finished(sink).catch(() => {})
        : new Promise(resume => sink.once('drain', () => resume()))
    }
  }

  unzip.onfile = file => {
    if (file.name === OTIOZ_VERSION_PATH || file.name === OTIOZ_CONTENT_PATH) {
      const into = file.name === OTIOZ_VERSION_PATH ? version : content
      file.ondata = (error, chunk) => {
        if (error) failure ??= error
        else
          try {
            collect(into, chunk)
          } catch (thrown) {
            failure ??= thrown instanceof Error ? thrown : new Error(String(thrown))
          }
      }
      file.start()
      return
    }

    const name = mediaNameOf(file.name)
    // Not a member of a bundle at all — another application's sidecar. Left unread rather than
    // refused: only an entry CLAIMING to be a medium and climbing out is hostile.
    if (name === null) return
    if (!isBundleEntry(file.name)) {
      failure ??= new BundleEscapeError(file.name)
      return
    }

    const sink = createWriteStream(join(into, name))
    // A full disk emits `error` here with nothing listening, which Node raises as an uncaught
    // exception — it would take the bundle process down and every other job with it, under a
    // message naming the exit code rather than the disk.
    sink.on('error', error => void (failure ??= error))
    sinks.push(sink)
    media.push({ entry: file.name, file: name })
    file.ondata = (error, chunk, final) => {
      if (error) failure ??= error
      else drain(sink, chunk, final)
    }
    file.start()
  }

  const room = async (): Promise<void> => {
    if (failure) throw failure
    if (signal?.aborted) throw new ImportCancelledError()
    if (!blocked) return

    const waiting = blocked
    blocked = null
    await waiting
  }

  try {
    let read = 0
    for await (const chunk of createReadStream(archive, { highWaterMark: 1 << 20 })) {
      unzip.push(chunk, false)
      read += chunk.length
      onStep?.(read, total)
      await room()
    }
    unzip.push(new Uint8Array(0), true)

    for (const sink of sinks) {
      sink.end()
      await finished(sink)
    }
    if (failure) throw failure

    if (version.bytes === 0 || content.bytes === 0) {
      throw new NotABundleError('this file carries no cut, so it is not a bundle')
    }

    const spelled = otiozMajorOf(strFromU8(joined(version)))
    if (spelled !== OTIOZ_MAJOR) {
      throw new NotABundleError(`this bundle is version ${spelled}, and this reader knows 1`)
    }

    return { content: strFromU8(joined(content)), media }
  } catch (error) {
    for (const sink of sinks) sink.destroy()
    if (error instanceof ImportCancelledError) return null
    throw error
  }
}

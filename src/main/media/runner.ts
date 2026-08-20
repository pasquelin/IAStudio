import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { open, stat } from 'node:fs/promises'
import { probeArgs } from './ffmpeg'
import { hashFile, parseProbe, type HashDeps, type ProbeOutcome } from './probe'

/**
 * ffprobe ships beside ffmpeg in every distribution of it, so it is resolved from the encoder
 * rather than looked up again — a user who pointed at one meant both.
 */
export function companionPath(ffmpeg: string | null): string | null {
  return ffmpeg === null ? null : ffmpeg.replace(/ffmpeg(\.exe)?$/i, 'ffprobe$1')
}

/**
 * Walks the PATH by hand rather than shelling out to `which`: a spawned shell would be one
 * more binary to depend on, and this runs at startup, where the main thread is the UI thread.
 */
export function findOnPath(
  binary: string,
  pathVariable: string | undefined,
  separator: string,
  exists: (candidate: string) => boolean,
): string | undefined {
  // `;` separates PATH entries on Windows and nowhere else, so it also tells which slash to
  // join with — `path.join` would use the host's, and the host is not always the target.
  const slash = separator === ';' ? '\\' : '/'

  for (const folder of pathVariable?.split(separator) ?? []) {
    if (!folder) continue
    const base = folder.endsWith(slash) ? folder : `${folder}${slash}`
    for (const candidate of [`${base}${binary}`, `${base}${binary}.exe`]) {
      if (exists(candidate)) return candidate
    }
  }
  return undefined
}

export type RunOptions = {
  signal?: AbortSignal
  /**
   * Killed after this long. Left out for an encode, which legitimately runs for minutes and is
   * stopped by its signal instead; set on the short calls, where hanging is never legitimate.
   */
  timeoutMs?: number
  /**
   * Called with each chunk as it arrives, in order. Given, stdout is folded rather than kept,
   * and the promise resolves empty — an hour of PCM is 57 MB nobody has to hold.
   */
  onStdout?: (chunk: Uint8Array) => void
}

// Plain `spawn`: this runs in the main process for a probe, which is short and only waits on
// a pipe, and inside the waveform process for a decode, which is neither — see `peaksWorker`.
export function runProcess(
  binary: string,
  args: readonly string[],
  { signal, timeoutMs, onStdout }: RunOptions = {},
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error(`${binary} cancelled before it started`))
      return
    }

    const child = spawn(binary, [...args], { signal })
    const stdout: Buffer[] = []
    // Kept whole rather than streamed away: ffmpeg says why it refused a file on stderr, and
    // that sentence is the only thing worth showing when an import fails.
    const stderr: Buffer[] = []

    // A binary that never answers would otherwise hold its slot in the ingest pool for the
    // rest of the session, and every file behind it waits on a process nobody is watching.
    const expiry =
      timeoutMs === undefined
        ? undefined
        : setTimeout(() => {
            child.kill()
            reject(new Error(`${binary} gave no answer in ${timeoutMs} ms`))
          }, timeoutMs)

    const fail = (error: Error): void => {
      clearTimeout(expiry)
      reject(error)
    }

    child.stdout.on('data', chunk => (onStdout ? onStdout(chunk) : stdout.push(chunk)))
    child.stderr.on('data', chunk => stderr.push(chunk))

    // A pipe torn down under an in-flight read — which is what killing ffmpeg mid-stream does
    // — emits on the stream itself. Unlistened, Node rethrows it and takes the main process,
    // and with it every window, down.
    child.stdout.on('error', fail)
    child.stderr.on('error', fail)
    child.on('error', fail)
    child.on('close', code => {
      clearTimeout(expiry)
      if (code === 0) resolve(Buffer.concat(stdout))
      else fail(new Error(`${binary} exited with ${code}: ${Buffer.concat(stderr).toString()}`))
    })
  })
}

const hashDeps: HashDeps = {
  size: async path => (await stat(path)).size,
  read: async (path, offset, length) => {
    const file = await open(path, 'r')
    try {
      const buffer = new Uint8Array(length)
      let filled = 0

      // Looped rather than read once: a single `pread` may come back short — routine on a
      // network volume — and a short read would silently change the hash of the same file.
      while (filled < length) {
        const { bytesRead } = await file.read(buffer, filled, length - filled, offset + filled)
        if (bytesRead === 0) break
        filled += bytesRead
      }

      return buffer.subarray(0, filled)
    } finally {
      await file.close()
    }
  },
  digest: chunks => {
    const hash = createHash('sha256')
    for (const chunk of chunks) hash.update(chunk)
    return hash.digest('hex')
  },
}

export function hashSource(path: string): Promise<string> {
  return hashFile(path, hashDeps)
}

/**
 * The same fingerprint, for the two ports that record one rather than compare one: what an import
 * writes on a row, and what the rescan reads off an orphan file.
 *
 * Beside `hashSource` and not at each wiring, which is what makes them the same answer AND the
 * same failure by construction: a file that cannot be read leaves the row without a fingerprint,
 * where throwing would cost the import that was carrying it.
 */
export const hashOrNull = (path: string): Promise<string | null> =>
  hashSource(path).catch(() => null)

/** How long a binary gets to print its own version before it counts as broken. */
const VERSION_TIMEOUT_MS = 5_000

/**
 * Answers already given, by binary path. A probe that fails asks this to tell a missing tool
 * from a bad file, and a folder of a hundred unreadable files would otherwise spawn a hundred
 * `-version` runs — 27 ms each here, serialized in the ingest pool.
 */
const RUNNABLE = new Map<string, Promise<boolean>>()

/**
 * Whether a binary actually runs. Existing on disk is not the same thing: a half-written
 * download, a quarantined file, or a binary built for the other architecture all sit there
 * looking installed, and the interface must not announce a pipeline that cannot encode.
 */
export async function binaryRuns(binary: string | null): Promise<boolean> {
  if (!binary) return false

  const known = RUNNABLE.get(binary)
  if (known) return known

  const answer = runProcess(binary, ['-version'], { timeoutMs: VERSION_TIMEOUT_MS }).then(
    () => true,
    () => false,
  )
  RUNNABLE.set(binary, answer)
  return answer
}

/** Forgets the answers. Invalidated with the resolver: ffmpeg may have been installed since. */
export function forgetBinaries(): void {
  RUNNABLE.clear()
}

/**
 * Reading headers, never transcoding. Generous enough for a rush on a network volume, short
 * enough that a wedged probe frees its slot in the ingest pool the same minute.
 */
const PROBE_TIMEOUT_MS = 30_000

/**
 * Probes with ffprobe. Says which of the two failures happened: without the binary the file is
 * imported unprobed, whereas a file ffprobe refuses is not media at all — see `ProbeOutcome`.
 */
export async function probeSource(
  ffprobe: string | null,
  source: string,
  options: RunOptions = {},
): Promise<ProbeOutcome> {
  if (!ffprobe) return { kind: 'unavailable' }

  try {
    const output = await runProcess(ffprobe, probeArgs(source), {
      timeoutMs: PROBE_TIMEOUT_MS,
      ...options,
    })
    const probe = parseProbe(JSON.parse(output.toString('utf8')))
    return probe ? { kind: 'probed', probe } : { kind: 'unreadable' }
  } catch {
    // Told apart only on the path that already failed, and asked once per session: a configured
    // path pointing at no binary is a missing tool, and every file behind it must import
    // unprobed rather than be refused as if it were the file's own fault.
    return (await binaryRuns(ffprobe)) ? { kind: 'unreadable' } : { kind: 'unavailable' }
  }
}

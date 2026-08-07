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
}

// `spawn` rather than the `utilityProcess` § 8.8 asks for: the work already happens in
// ffmpeg's own process, and the main thread only waits on a pipe.
export function runProcess(
  binary: string,
  args: readonly string[],
  { signal, timeoutMs }: RunOptions = {},
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
        ? null
        : setTimeout(() => {
            child.kill()
            reject(new Error(`${binary} gave no answer in ${timeoutMs} ms`))
          }, timeoutMs)

    const settle = (outcome: () => void): void => {
      if (expiry) clearTimeout(expiry)
      outcome()
    }

    child.stdout.on('data', chunk => stdout.push(chunk))
    child.stderr.on('data', chunk => stderr.push(chunk))

    // A pipe torn down under an in-flight read — which is what killing ffmpeg mid-stream does
    // — emits on the stream itself. Unlistened, Node rethrows it and takes the main process,
    // and with it every window, down.
    child.stdout.on('error', error => settle(() => reject(error)))
    child.stderr.on('error', error => settle(() => reject(error)))
    child.on('error', error => settle(() => reject(error)))
    child.on('close', code =>
      settle(() => {
        if (code === 0) resolve(Buffer.concat(stdout))
        else reject(new Error(`${binary} exited with ${code}: ${Buffer.concat(stderr).toString()}`))
      }),
    )
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

/** How long a binary gets to print its own version before it counts as broken. */
export const VERSION_TIMEOUT_MS = 5_000

/**
 * Whether a binary actually runs. Existing on disk is not the same thing: a half-written
 * download, a quarantined file, or a binary built for the other architecture all sit there
 * looking installed, and the interface must not announce a pipeline that cannot encode.
 */
export async function binaryRuns(binary: string | null): Promise<boolean> {
  if (!binary) return false

  try {
    await runProcess(binary, ['-version'], { timeoutMs: VERSION_TIMEOUT_MS })
    return true
  } catch {
    return false
  }
}

/**
 * Reading headers, never transcoding. Generous enough for a rush on a network volume, short
 * enough that a wedged probe frees its slot in the ingest pool the same minute.
 */
export const PROBE_TIMEOUT_MS = 30_000

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
    // Told apart only here, on the path that already failed, where one more spawn costs
    // nothing: a configured path pointing at no binary is a missing tool, and every file
    // behind it must import unprobed rather than be refused as if it were the file's fault.
    return (await binaryRuns(ffprobe)) ? { kind: 'unreadable' } : { kind: 'unavailable' }
  }
}

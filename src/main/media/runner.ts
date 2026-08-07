import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { open, stat } from 'node:fs/promises'
import type { MediaProbe } from '@shared/domain/asset'
import { probeArgs } from './ffmpeg'
import { hashFile, parseProbe, type HashDeps } from './probe'

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

export type RunOptions = { signal?: AbortSignal }

// `spawn` rather than the `utilityProcess` § 8.8 asks for: the work already happens in
// ffmpeg's own process, and the main thread only waits on a pipe.
export function runProcess(
  binary: string,
  args: readonly string[],
  { signal }: RunOptions = {},
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

    child.stdout.on('data', chunk => stdout.push(chunk))
    child.stderr.on('data', chunk => stderr.push(chunk))

    // A pipe torn down under an in-flight read — which is what killing ffmpeg mid-stream does
    // — emits on the stream itself. Unlistened, Node rethrows it and takes the main process,
    // and with it every window, down.
    child.stdout.on('error', reject)
    child.stderr.on('error', reject)
    child.on('error', reject)
    child.on('close', code => {
      if (code === 0) resolve(Buffer.concat(stdout))
      else reject(new Error(`${binary} exited with ${code}: ${Buffer.concat(stderr).toString()}`))
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
 * Probes with ffprobe, or answers nothing at all. A missing probe is a legitimate outcome —
 * ffmpeg may not be installed — and the timeline already falls back to a default duration.
 */
export async function probeSource(
  ffprobe: string | null,
  source: string,
  options: RunOptions = {},
): Promise<MediaProbe | null> {
  if (!ffprobe) return null

  try {
    const output = await runProcess(ffprobe, probeArgs(source), options)
    return parseProbe(JSON.parse(output.toString('utf8')))
  } catch {
    return null
  }
}

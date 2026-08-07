import { join } from 'node:path'

/**
 * Where the shipped encoder sits, per platform. The studio carries its own rather than asking
 * for one: an import that needs a proxy is not the moment to teach someone what a codec is.
 *
 * `root` is `process.resourcesPath` once packaged, and the project's `resources/` in
 * development — where `scripts/fetch-ffmpeg.mjs` puts it.
 */
export function bundledFfmpeg(root: string, platform: NodeJS.Platform): string {
  return join(root, 'ffmpeg', platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg')
}

export type FfmpegCandidates = {
  /** Shipped beside the app, when there is one. */
  bundled: string | undefined
  /** `settings.media.ffmpegPath`, set by the user in the preferences. */
  configured: string | undefined
  /** What a lookup on the `PATH` found. */
  onPath: string | undefined
  exists: (candidate: string) => boolean
}

/**
 * Bundled, then configured, then whatever is on the PATH — and null rather than a throw when
 * there is none: an import of a decodable MP4 still works, and the interface says what is missing.
 */
export function resolveFfmpeg({
  bundled,
  configured,
  onPath,
  exists,
}: FfmpegCandidates): string | null {
  for (const candidate of [bundled, configured, onPath]) {
    if (candidate && exists(candidate)) return candidate
  }
  return null
}

export type FfmpegResolver = {
  path: () => string | null
  /** Forgets what was resolved — ffmpeg may have been installed since. */
  invalidate: () => void
}

/**
 * Resolution is a walk of the PATH with a `existsSync` per entry, and `path()` is asked twice
 * per ingested file. Cached, then, and invalidated on the two events that can change the
 * answer: the configured path being edited, and someone asking what the pipeline can do.
 */
export function createFfmpegResolver(candidates: () => FfmpegCandidates): FfmpegResolver {
  let resolved: { binary: string | null } | null = null

  return {
    path: () => {
      resolved ??= { binary: resolveFfmpeg(candidates()) }
      return resolved.binary
    },
    invalidate: () => {
      resolved = null
    },
  }
}

export function probeArgs(source: string): string[] {
  return ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', source]
}

/** H.264 720p stand-in. `-2` keeps the width even, which the encoder requires. */
export function proxyArgs(source: string, destination: string): string[] {
  return [
    '-y',
    // Without these, ffmpeg writes a progress line to stderr every second of a long encode,
    // and the runner keeps every one of them until the process exits.
    '-v',
    'error',
    '-nostats',
    '-i',
    source,
    '-vf',
    'scale=-2:720',
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '23',
    '-g',
    '30',
    '-c:a',
    'aac',
    '-movflags',
    '+faststart',
    destination,
  ]
}

/**
 * What the waveform is reduced from. Exported because the reducer needs it to know how many
 * samples one peak covers: read from two places that could drift, the waveform would be the
 * right shape drawn at the wrong speed.
 */
export const PEAKS_SAMPLE_RATE = 8_000

/** Mono 16-bit PCM on stdout: the waveform is reduced from it once, never at paint time. */
export function peaksArgs(source: string): string[] {
  return [
    '-v',
    'error',
    '-i',
    source,
    '-f',
    's16le',
    '-ac',
    '1',
    '-ar',
    `${PEAKS_SAMPLE_RATE}`,
    'pipe:1',
  ]
}

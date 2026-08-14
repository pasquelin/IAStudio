import { usToSeconds, type Us } from '@shared/domain/time'

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

/** How the frames of a render are named on disk. Zero-padded, since ffmpeg counts in order. */
export const FRAME_PATTERN = 'frame_%06d.png'

export function frameName(index: number): string {
  return `frame_${String(index).padStart(6, '0')}.png`
}

/**
 * A folder of numbered stills into one H.264 file.
 *
 * `-framerate` BEFORE `-i` and not after: placed after, it is read as an output rate and ffmpeg
 * duplicates or drops frames to reach it rather than declaring what the stills already are.
 *
 * `yuv420p` because a render arrives in RGBA and libx264 would otherwise pick a format most
 * players refuse — a file that plays everywhere is the point of encoding it at all.
 */
export function sequenceArgs(pattern: string, destination: string, fps: number): string[] {
  return [
    '-y',
    '-v',
    'error',
    '-nostats',
    '-framerate',
    String(fps),
    '-i',
    pattern,
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '18',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    destination,
  ]
}

/**
 * Where the still of a rush is taken from, in seconds — a tenth of the way in.
 *
 * Not the first frame: a take opens on black often enough that a shelf of them would be a shelf
 * of black tiles, which is the very thing the still exists to fix.
 */
export function posterOffset(duration: Us): number {
  return usToSeconds(duration) / 10
}

/**
 * One frame of a rush, as the picture that stands for it in a grid and on a clip.
 *
 * `-ss` BEFORE `-i`, which seeks by keyframe without decoding what precedes: after `-i` ffmpeg
 * decodes from zero, and a still cost as much as the proxy on a long take. 360 lines because
 * nothing paints it larger than a tile.
 */
export function posterArgs(source: string, destination: string, atSeconds: number): string[] {
  return [
    '-y',
    '-v',
    'error',
    '-nostats',
    '-ss',
    atSeconds.toFixed(3),
    '-i',
    source,
    '-frames:v',
    '1',
    '-vf',
    'scale=-2:360',
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

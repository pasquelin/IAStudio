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

/** Mono 16-bit PCM on stdout: the waveform is reduced from it once, never at paint time. */
export function peaksArgs(source: string): string[] {
  return ['-v', 'error', '-i', source, '-f', 's16le', '-ac', '1', '-ar', '8000', 'pipe:1']
}

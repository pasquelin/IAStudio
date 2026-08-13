import { mediaProbeOf, probeNumber, type MediaProbe } from '@shared/domain/asset'
import { isRecord } from '@shared/guards'

/** ffprobe reports a frame rate as a rational — `30000/1001`, and `0/0` for a still picture. */
function frameRateOf(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined

  const [numerator, denominator] = value.split('/').map(Number)
  if (!numerator || !denominator) return undefined
  return numerator / denominator
}

function streamsOf(raw: unknown): Record<string, unknown>[] {
  if (!isRecord(raw) || !Array.isArray(raw.streams)) return []
  return raw.streams.filter(isRecord)
}

function isCoverArt(stream: Record<string, unknown>): boolean {
  return isRecord(stream.disposition) && stream.disposition.attached_pic === 1
}

const SECOND = 1_000_000

/**
 * What `ffprobe -print_format json -show_format -show_streams` hands back. Everything is
 * `unknown` until proven otherwise: the output comes from a binary the user pointed at.
 */
export function parseProbe(raw: unknown): MediaProbe | null {
  const streams = streamsOf(raw)
  // Cover art is a video stream to ffprobe. Read as one, an MP3 earns a proxy of its artwork.
  const video = streams.find(stream => stream.codec_type === 'video' && !isCoverArt(stream))
  const audio = streams.find(stream => stream.codec_type === 'audio')
  const carrier = video ?? audio
  if (!carrier || typeof carrier.codec_name !== 'string') return null

  const format = isRecord(raw) && isRecord(raw.format) ? raw.format : {}
  const seconds = probeNumber(format.duration) ?? probeNumber(carrier.duration)

  return mediaProbeOf({
    duration: Math.round((seconds ?? 0) * SECOND),
    codec: carrier.codec_name,
    width: probeNumber(video?.width),
    height: probeNumber(video?.height),
    fps: frameRateOf(video?.r_frame_rate),
    sampleRate: probeNumber(audio?.sample_rate),
    channels: probeNumber(audio?.channels),
  })
}

/**
 * What probing a file answered. The two failures are not the same failure: no ffprobe means the
 * studio is missing a tool, and the file is imported unprobed; a refused file means the file
 * itself is not media, and letting that one through is how a renamed text document ends up in
 * the catalogue as a video that plays nothing.
 */
export type ProbeOutcome =
  { kind: 'probed'; probe: MediaProbe } | { kind: 'unavailable' } | { kind: 'unreadable' }

export type ByteRange = { offset: number; length: number }

/**
 * Head, middle and tail. Hashing twenty gigabytes on every import would cost minutes for
 * nothing: this identifies a file for relinking, it does not prove its integrity. A file too
 * small to sample without overlap is read whole.
 */
export function sampleRanges(size: number, slice: number): ByteRange[] {
  if (size <= 0) return []
  if (size <= slice * 3) return [{ offset: 0, length: size }]

  return [
    { offset: 0, length: slice },
    { offset: Math.floor((size - slice) / 2), length: slice },
    { offset: size - slice, length: slice },
  ]
}

/** One mebibyte per slice: enough to separate two rushes, small enough to read instantly. */
const HASH_SLICE = 1024 * 1024

export type HashDeps = {
  size: (path: string) => Promise<number>
  read: (path: string, offset: number, length: number) => Promise<Uint8Array>
  digest: (chunks: readonly Uint8Array[]) => string
}

/** The size is hashed with the bytes: two takes can share a head and differ only in length. */
export async function hashFile(path: string, deps: HashDeps): Promise<string> {
  const size = await deps.size(path)
  const chunks: Uint8Array[] = [new TextEncoder().encode(`${size}`)]

  for (const range of sampleRanges(size, HASH_SLICE)) {
    chunks.push(await deps.read(path, range.offset, range.length))
  }

  return deps.digest(chunks)
}

import { mediaProbeOf, type MediaProbe } from '@shared/domain/asset'
import { isRecord } from '@shared/guards'

function numberOf(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return undefined

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

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

const SECOND = 1_000_000

/**
 * What `ffprobe -print_format json -show_format -show_streams` hands back. Everything is
 * `unknown` until proven otherwise: the output comes from a binary the user pointed at.
 */
export function parseProbe(raw: unknown): MediaProbe | null {
  const streams = streamsOf(raw)
  const video = streams.find(stream => stream.codec_type === 'video')
  const audio = streams.find(stream => stream.codec_type === 'audio')
  const carrier = video ?? audio
  if (!carrier || typeof carrier.codec_name !== 'string') return null

  const format = isRecord(raw) && isRecord(raw.format) ? raw.format : {}
  const seconds = numberOf(format.duration) ?? numberOf(carrier.duration)

  return mediaProbeOf({
    duration: Math.round((seconds ?? 0) * SECOND),
    codec: carrier.codec_name,
    width: numberOf(video?.width),
    height: numberOf(video?.height),
    fps: frameRateOf(video?.r_frame_rate),
    sampleRate: numberOf(audio?.sample_rate),
    channels: numberOf(audio?.channels),
  })
}

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
export const HASH_SLICE = 1024 * 1024

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

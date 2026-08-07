import type { MediaProbe } from '@shared/domain/asset'

const HEADER_BYTES = 44
const RIFF = 0x52494646
const WAVE = 0x57415645

/**
 * What a WAV header says about itself.
 *
 * Read rather than assumed, even though the studio wrote the file: a probe carried over from
 * before an edit is worse than no probe at all — a six-second take indexed as ten puts a clip
 * of ten seconds on the timeline, four of them silence.
 *
 * Only the canonical 44-byte header is understood, which is the one `encodeWav` writes. Any
 * other layout answers null rather than guessing.
 */
export function probeWav(bytes: Uint8Array): MediaProbe | null {
  if (bytes.byteLength < HEADER_BYTES) return null

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (view.getUint32(0) !== RIFF || view.getUint32(8) !== WAVE) return null

  const channels = view.getUint16(22, true)
  const sampleRate = view.getUint32(24, true)
  const bitsPerSample = view.getUint16(34, true)
  const dataBytes = view.getUint32(40, true)

  const blockAlign = channels * (bitsPerSample / 8)
  if (channels === 0 || sampleRate === 0 || blockAlign === 0) return null

  const frames = Math.min(dataBytes, bytes.byteLength - HEADER_BYTES) / blockAlign
  return {
    duration: Math.round((frames / sampleRate) * 1_000_000),
    codec: 'pcm_s16le',
    sampleRate,
    channels,
  }
}

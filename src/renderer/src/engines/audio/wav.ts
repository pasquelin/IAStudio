import { frameCount, type AudioData } from './audio-data'

const HEADER_BYTES = 44
const BITS_PER_SAMPLE = 16

/**
 * A 16-bit PCM WAV, written by hand.
 *
 * Uncompressed on purpose: this is what the studio hands back to disk after an edit, and
 * re-encoding to a lossy format would put a second generation of artefacts on a take that has
 * already been through one. Encoding it here also keeps ffmpeg out of the audio editor
 * entirely — the browser decoded it, the browser writes it back.
 */
export function encodeWav(data: AudioData): Uint8Array<ArrayBuffer> {
  const channels = data.channels.length > 0 ? data.channels : [new Float32Array(0)]
  const count = channels.length
  const frames = frameCount(data)
  const blockAlign = count * (BITS_PER_SAMPLE / 8)
  const bytes = new ArrayBuffer(HEADER_BYTES + frames * blockAlign)
  const view = new DataView(bytes)

  const ascii = (offset: number, text: string): void => {
    for (let index = 0; index < text.length; index++) {
      view.setUint8(offset + index, text.charCodeAt(index))
    }
  }

  ascii(0, 'RIFF')
  view.setUint32(4, bytes.byteLength - 8, true)
  ascii(8, 'WAVE')
  ascii(12, 'fmt ')
  view.setUint32(16, 16, true)
  // 1 is uncompressed PCM; anything else needs a codec on the reading side.
  view.setUint16(20, 1, true)
  view.setUint16(22, count, true)
  view.setUint32(24, data.sampleRate, true)
  view.setUint32(28, data.sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, BITS_PER_SAMPLE, true)
  ascii(36, 'data')
  view.setUint32(40, frames * blockAlign, true)

  // An `Int16Array` over the body rather than `setInt16` per sample: seventeen million DataView
  // calls for a three-minute stereo take is seven times the cost of the same loop through a
  // typed array. It writes in platform order, and WAV is little-endian — which every platform
  // Electron ships for is. The header above keeps its DataView: forty-four bytes, written once.
  const samples = new Int16Array(bytes, HEADER_BYTES, frames * count)

  for (let channel = 0; channel < count; channel++) {
    const source = channels[channel]
    if (!source) continue

    // Interleaved, but walked one channel at a time: the source array then stays in cache for
    // its whole pass instead of being swapped on every frame.
    for (let frame = 0, at = channel; frame < frames; frame++, at += count) {
      const sample = source[frame] ?? 0
      const clamped = sample < -1 ? -1 : sample > 1 ? 1 : sample
      // Asymmetric on purpose: the negative side of a 16-bit range reaches one step further.
      samples[at] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff
    }
  }

  return new Uint8Array(bytes)
}

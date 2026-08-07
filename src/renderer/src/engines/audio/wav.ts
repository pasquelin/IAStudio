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
export function encodeWav(data: AudioData): Uint8Array {
  const channels = Math.max(1, data.channels.length)
  const frames = frameCount(data)
  const blockAlign = channels * (BITS_PER_SAMPLE / 8)
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
  view.setUint16(22, channels, true)
  view.setUint32(24, data.sampleRate, true)
  view.setUint32(28, data.sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, BITS_PER_SAMPLE, true)
  ascii(36, 'data')
  view.setUint32(40, frames * blockAlign, true)

  let offset = HEADER_BYTES
  for (let frame = 0; frame < frames; frame++) {
    for (let channel = 0; channel < channels; channel++) {
      const sample = Math.max(-1, Math.min(1, data.channels[channel]?.[frame] ?? 0))
      // Asymmetric on purpose: the negative side of a 16-bit range reaches one step further.
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += 2
    }
  }

  return new Uint8Array(bytes)
}

import { describe, expect, it } from 'vitest'
import { probeWav } from './wav'

/** The canonical 44-byte header, as `engines/audio/wav.ts` writes it. */
function header(options: {
  channels: number
  sampleRate: number
  bitsPerSample: number
  dataBytes: number
}): Uint8Array {
  const bytes = new ArrayBuffer(44 + options.dataBytes)
  const view = new DataView(bytes)
  const ascii = (at: number, text: string): void => {
    for (let index = 0; index < text.length; index++)
      view.setUint8(at + index, text.charCodeAt(index))
  }

  ascii(0, 'RIFF')
  ascii(8, 'WAVE')
  ascii(12, 'fmt ')
  view.setUint16(20, 1, true)
  view.setUint16(22, options.channels, true)
  view.setUint32(24, options.sampleRate, true)
  view.setUint16(34, options.bitsPerSample, true)
  ascii(36, 'data')
  view.setUint32(40, options.dataBytes, true)

  return new Uint8Array(bytes)
}

const oneSecondMono = (): Uint8Array =>
  header({ channels: 1, sampleRate: 48_000, bitsPerSample: 16, dataBytes: 48_000 * 2 })

describe('probing a wav', () => {
  it('reads the duration the header describes', () => {
    expect(probeWav(oneSecondMono())).toEqual({
      duration: 1_000_000,
      codec: 'pcm_s16le',
      sampleRate: 48_000,
      channels: 1,
    })
  })

  it('halves the duration for the same bytes across two channels', () => {
    const stereo = header({
      channels: 2,
      sampleRate: 48_000,
      bitsPerSample: 16,
      dataBytes: 48_000 * 2,
    })
    expect(probeWav(stereo)?.duration).toBe(500_000)
  })

  it('trusts the file over its own header when the data chunk claims too much', () => {
    const truncated = header({
      channels: 1,
      sampleRate: 48_000,
      bitsPerSample: 16,
      dataBytes: 48_000 * 2,
    }).subarray(0, 44 + 24_000 * 2)

    expect(probeWav(truncated)?.duration).toBe(500_000)
  })

  it('refuses anything that is not a RIFF/WAVE file', () => {
    expect(probeWav(new Uint8Array(64))).toBeNull()
  })

  it('refuses a file too short to hold a header', () => {
    expect(probeWav(new Uint8Array(12))).toBeNull()
  })

  it('refuses a header whose numbers make no sense, rather than dividing by zero', () => {
    expect(
      probeWav(header({ channels: 0, sampleRate: 48_000, bitsPerSample: 16, dataBytes: 8 })),
    ).toBeNull()
    expect(
      probeWav(header({ channels: 1, sampleRate: 0, bitsPerSample: 16, dataBytes: 8 })),
    ).toBeNull()
  })
})

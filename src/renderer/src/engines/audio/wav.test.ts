import { describe, expect, it } from 'vitest'
import type { AudioData } from './audio-data'
import { encodeWav } from './wav'

const HEADER_BYTES = 44

function bodyOf(wav: Uint8Array): Int16Array {
  return new Int16Array(wav.buffer.slice(wav.byteOffset + HEADER_BYTES))
}

function textAt(wav: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...wav.subarray(offset, offset + length))
}

const stereo: AudioData = {
  sampleRate: 48_000,
  channels: [new Float32Array([0, 0.5, -0.5, 1]), new Float32Array([1, -1, 0.25, 0])],
}

describe('encodeWav', () => {
  it('writes a canonical 44 byte RIFF/WAVE header', () => {
    const wav = encodeWav(stereo)
    const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength)

    expect(textAt(wav, 0, 4)).toBe('RIFF')
    expect(textAt(wav, 8, 4)).toBe('WAVE')
    expect(textAt(wav, 12, 4)).toBe('fmt ')
    expect(textAt(wav, 36, 4)).toBe('data')

    expect(view.getUint32(4, true)).toBe(wav.byteLength - 8)
    expect(view.getUint16(20, true)).toBe(1)
    expect(view.getUint16(22, true)).toBe(2)
    expect(view.getUint32(24, true)).toBe(48_000)
    expect(view.getUint32(28, true)).toBe(48_000 * 4)
    expect(view.getUint16(32, true)).toBe(4)
    expect(view.getUint16(34, true)).toBe(16)
    expect(view.getUint32(40, true)).toBe(4 * 4)
  })

  it('interleaves the channels frame by frame', () => {
    expect([...bodyOf(encodeWav(stereo))]).toEqual([
      0, 32767, 16383, -32768, -16384, 8191, 32767, 0,
    ])
  })

  it('writes samples little-endian, whatever the platform', () => {
    const wav = encodeWav({ sampleRate: 8_000, channels: [new Float32Array([1])] })
    // 32767 is 0x7fff: low byte first is what a WAV reader expects.
    expect(wav[HEADER_BYTES]).toBe(0xff)
    expect(wav[HEADER_BYTES + 1]).toBe(0x7f)
  })

  it('reaches one step further on the negative side of the range', () => {
    const wav = encodeWav({ sampleRate: 8_000, channels: [new Float32Array([-1, 1])] })
    expect([...bodyOf(wav)]).toEqual([-32768, 32767])
  })

  it('clamps a sample that left the -1..1 range rather than wrapping it', () => {
    const wav = encodeWav({ sampleRate: 8_000, channels: [new Float32Array([4, -4])] })
    expect([...bodyOf(wav)]).toEqual([32767, -32768])
  })

  it('writes a header alone for a take with no frames', () => {
    const wav = encodeWav({ sampleRate: 48_000, channels: [new Float32Array(0)] })
    expect(wav.byteLength).toBe(HEADER_BYTES)
    expect(new DataView(wav.buffer).getUint32(40, true)).toBe(0)
  })

  it('claims one channel for a take that carries none', () => {
    const wav = encodeWav({ sampleRate: 48_000, channels: [] })
    expect(new DataView(wav.buffer).getUint16(22, true)).toBe(1)
    expect(wav.byteLength).toBe(HEADER_BYTES)
  })
})

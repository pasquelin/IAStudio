import { describe, expect, it } from 'vitest'
import { decodePeaks, peaksFromBytes, samplesOf } from './peaks'

describe('waveform peaks', () => {
  it('reduces samples to one min/max pair per bucket', () => {
    const pcm = Int16Array.from([0, 16_384, -16_384, 32_767, 0, -32_768])
    const peaks = decodePeaks(pcm, 2)

    expect(peaks).toHaveLength(4)
    expect(peaks[0]).toBeCloseTo(-0.5, 2)
    expect(peaks[1]).toBeCloseTo(0.5, 2)
  })

  it('survives a bucket count larger than the sample count', () => {
    expect(decodePeaks(Int16Array.from([0, 1]), 8)).toHaveLength(16)
  })

  it('reads silence as a flat line rather than as nothing', () => {
    const peaks = decodePeaks(new Int16Array(64), 4)
    expect(peaks).toHaveLength(8)
    expect([...peaks].every(value => value === 0)).toBe(true)
  })

  it('normalises to -1..1, which is what the painter expects', () => {
    const peaks = decodePeaks(Int16Array.from([32_767, -32_768]), 1)
    expect(peaks[0]).toBeCloseTo(-1, 2)
    expect(peaks[1]).toBeCloseTo(1, 2)
  })
})

describe('reading peaks back', () => {
  it('returns what was written, through a full round trip', () => {
    const written = decodePeaks(Int16Array.from([32_767, -32_768, 0, 0]), 2)
    expect([...peaksFromBytes(new Uint8Array(written.buffer))]).toEqual([...written])
  })

  it('reads a buffer whose offset is not four-byte aligned', () => {
    const written = decodePeaks(Int16Array.from([32_767, -32_768]), 1)
    // What `readFile` hands back: a view into a pooled buffer, at an arbitrary offset.
    const pooled = new Uint8Array(written.byteLength + 3)
    pooled.set(new Uint8Array(written.buffer), 3)

    const read = peaksFromBytes(pooled.subarray(3))
    expect([...read]).toEqual([...written])
  })

  it('drops a trailing partial value rather than throwing on a truncated file', () => {
    const written = decodePeaks(Int16Array.from([32_767, -32_768]), 1)
    const truncated = new Uint8Array(written.buffer).subarray(0, written.byteLength - 2)

    expect(peaksFromBytes(truncated)).toHaveLength(1)
  })

  it('reads an empty file as no waveform at all', () => {
    expect(peaksFromBytes(new Uint8Array())).toHaveLength(0)
  })
})

describe('sample view', () => {
  it('reads samples straight out of an aligned buffer', () => {
    const pcm = new Uint8Array(Int16Array.from([100, -100]).buffer)
    expect([...samplesOf(pcm)]).toEqual([100, -100])
  })

  it('reads a buffer whose offset is odd, which no Int16Array can be laid over', () => {
    const source = new Uint8Array(5)
    source.set(new Uint8Array(Int16Array.from([100, -100]).buffer), 1)

    expect([...samplesOf(source.subarray(1))]).toEqual([100, -100])
  })

  it('reads a Node Buffer at an odd offset, which is what ffmpeg output arrives as', () => {
    // `Buffer.prototype.slice` is an alias of `subarray`: it would hand back the odd offset.
    const source = Buffer.alloc(5)
    source.set(new Uint8Array(Int16Array.from([100, -100]).buffer), 1)

    expect([...samplesOf(source.subarray(1))]).toEqual([100, -100])
  })

  it('drops a trailing odd byte rather than reading past the buffer', () => {
    expect(samplesOf(new Uint8Array(5))).toHaveLength(2)
  })
})

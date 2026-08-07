import { describe, expect, it } from 'vitest'
import { createPeakReducer, peaksFromBytes } from './peaks'

/** Mono 16-bit little-endian, which is what `s16le` puts on ffmpeg's stdout. */
const pcm = (...samples: number[]): Uint8Array => new Uint8Array(Int16Array.from(samples).buffer)

/** The whole waveform, from one push — the shape the reducer must also reach chunk by chunk. */
function reduce(buckets: number, samplesPerBucket: number, bytes: Uint8Array): Float32Array {
  const reducer = createPeakReducer(buckets, samplesPerBucket)
  reducer.push(bytes)
  return reducer.finish()
}

describe('waveform peaks', () => {
  it('reduces samples to one min/max pair per bucket', () => {
    const peaks = reduce(2, 3, pcm(0, 16_384, -16_384, 32_767, 0, -32_768))

    expect(peaks).toHaveLength(4)
    expect(peaks[0]).toBeCloseTo(-0.5, 2)
    expect(peaks[1]).toBeCloseTo(0.5, 2)
    expect(peaks[2]).toBeCloseTo(-1, 2)
    expect(peaks[3]).toBeCloseTo(1, 2)
  })

  it('survives a bucket count larger than the sample count', () => {
    expect(reduce(8, 1, pcm(0, 1))).toHaveLength(16)
  })

  it('reads silence as a flat line rather than as nothing', () => {
    const peaks = reduce(4, 16, new Uint8Array(128))

    expect(peaks).toHaveLength(8)
    expect([...peaks].every(value => value === 0)).toBe(true)
  })

  it('normalises to -1..1, which is what the painter expects', () => {
    const peaks = reduce(1, 2, pcm(32_767, -32_768))

    expect(peaks[0]).toBeCloseTo(-1, 2)
    expect(peaks[1]).toBeCloseTo(1, 2)
  })

  it('drops what runs past the last bucket rather than writing outside the waveform', () => {
    expect(() => reduce(1, 2, pcm(1, 2, 3, 4, 5, 6))).not.toThrow()
    expect(reduce(1, 2, pcm(1, 2, 3, 4))).toHaveLength(2)
  })

  /**
   * ffmpeg writes 64 kB at a time and a sample straddles the boundary every other chunk. Read
   * one byte off, every sample after it is noise — the waveform of a different recording.
   */
  it('reaches the same waveform whether the PCM arrives whole or in pieces', () => {
    const bytes = pcm(0, 16_384, -16_384, 32_767, 0, -32_768)
    const streamed = createPeakReducer(2, 3)

    // Split at an odd byte, which is where half a sample is left hanging.
    streamed.push(bytes.subarray(0, 3))
    streamed.push(bytes.subarray(3, 8))
    streamed.push(bytes.subarray(8))

    expect([...streamed.finish()]).toEqual([...reduce(2, 3, bytes)])
  })

  it('ignores an empty chunk, which a pipe emits on its own', () => {
    const reducer = createPeakReducer(1, 2)
    reducer.push(new Uint8Array())
    reducer.push(pcm(32_767, -32_768))

    expect(reducer.finish()[1]).toBeCloseTo(1, 2)
  })

  it('leaves a trailing half sample out rather than reading it as a whole one', () => {
    const reducer = createPeakReducer(1, 2)
    reducer.push(new Uint8Array([0xff]))

    expect([...reducer.finish()]).toEqual([0, 0])
  })
})

describe('reading peaks back', () => {
  it('returns what was written, through a full round trip', () => {
    const written = reduce(2, 2, pcm(32_767, -32_768, 0, 0))
    expect([...peaksFromBytes(new Uint8Array(written.buffer))]).toEqual([...written])
  })

  it('reads a buffer whose offset is not four-byte aligned', () => {
    const written = reduce(1, 2, pcm(32_767, -32_768))
    // What `readFile` hands back: a view into a pooled buffer, at an arbitrary offset.
    const pooled = new Uint8Array(written.byteLength + 3)
    pooled.set(new Uint8Array(written.buffer), 3)

    expect([...peaksFromBytes(pooled.subarray(3))]).toEqual([...written])
  })

  it('drops a trailing partial value rather than throwing on a truncated file', () => {
    const written = reduce(1, 2, pcm(32_767, -32_768))
    const truncated = new Uint8Array(written.buffer).subarray(0, written.byteLength - 2)

    expect(peaksFromBytes(truncated)).toHaveLength(1)
  })

  it('reads an empty file as no waveform at all', () => {
    expect(peaksFromBytes(new Uint8Array())).toHaveLength(0)
  })
})

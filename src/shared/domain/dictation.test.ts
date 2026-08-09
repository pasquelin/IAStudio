import { describe, expect, it } from 'vitest'
import { rmsOf, STT_MODEL_BYTES, STT_MODEL_FILES } from './dictation'

describe('the model manifest', () => {
  it('names four files, each with a digest and a size', () => {
    expect(STT_MODEL_FILES.map(file => file.name)).toEqual([
      'encoder.int8.onnx',
      'decoder.int8.onnx',
      'joiner.int8.onnx',
      'tokens.txt',
    ])

    for (const file of STT_MODEL_FILES) {
      expect(file.sha256).toMatch(/^[0-9a-f]{64}$/)
      expect(file.bytes).toBeGreaterThan(0)
      expect(file.url.startsWith('https://')).toBe(true)
    }
  })

  // The progress bar counts against this total, and a mismatch would have it stall short of the
  // end or run past it — both of which read as a download that failed.
  it('totals what the four files weigh', () => {
    expect(STT_MODEL_BYTES).toBe(670_478_772)
  })

  it('fetches every file from one place, so a moved repository moves once', () => {
    const hosts = new Set(STT_MODEL_FILES.map(file => new URL(file.url).host))
    expect([...hosts]).toEqual(['huggingface.co'])
  })
})

describe('rmsOf', () => {
  it('is zero for silence', () => {
    expect(rmsOf(new Float32Array(64))).toBe(0)
  })

  it('is one for a signal at full scale', () => {
    expect(rmsOf(new Float32Array([1, -1, 1, -1]))).toBe(1)
  })

  it('reads a half-scale square wave at half scale', () => {
    expect(rmsOf(new Float32Array([0.5, -0.5, 0.5, -0.5]))).toBeCloseTo(0.5, 6)
  })

  // A clipped sample sits just past full scale, and a meter that draws past its own end reads
  // as a bug rather than as loud.
  it('clamps a signal that overshoots', () => {
    expect(rmsOf(new Float32Array([1.4, -1.4]))).toBe(1)
  })

  it('is zero for an empty chunk rather than NaN', () => {
    expect(rmsOf(new Float32Array(0))).toBe(0)
  })
})

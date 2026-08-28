import { describe, expect, it } from 'vitest'
import { digestOf, embeddedTextOf, normalised, packed, similarity, unpacked } from './vectors'

describe('normalising', () => {
  it('brings a vector to unit length', () => {
    const unit = normalised(new Float32Array([3, 4]))

    expect(unit[0]).toBeCloseTo(0.6, 6)
    expect(unit[1]).toBeCloseTo(0.8, 6)
  })

  /** An embedder answering all zeroes is broken; dividing by its length would answer NaN. */
  it('leaves a vector of no length alone', () => {
    expect([...normalised(new Float32Array([0, 0]))]).toEqual([0, 0])
  })
})

describe('comparing', () => {
  it('scores identical directions at one and opposite ones at minus one', () => {
    const one = normalised(new Float32Array([1, 1]))

    expect(similarity(one, one)).toBeCloseTo(1, 6)
    expect(similarity(one, normalised(new Float32Array([-1, -1])))).toBeCloseTo(-1, 6)
  })

  /**
   * 🛑 An index that survived a change of model holds both lengths at once. A retrieval must
   * answer rather than throw, and « nothing alike » is the honest answer for a vector this
   * model never made.
   */
  it('scores vectors of different lengths as nothing alike', () => {
    expect(similarity(new Float32Array([1, 0]), new Float32Array([1, 0, 0]))).toBe(0)
    expect(similarity(new Float32Array(), new Float32Array())).toBe(0)
  })
})

describe('the blob a column holds', () => {
  it('gives the same floats back', () => {
    const values = normalised(new Float32Array([0.5, -0.25, 0.125]))

    expect([...unpacked(packed(values))]).toEqual([...values])
  })

  /**
   * `packed` slices, and this is what that is for: a view over a longer buffer would write the
   * whole of it to the column, and read back as a vector of the wrong length.
   */
  it('writes only the vector, not the buffer behind it', () => {
    const long = new Float32Array([1, 2, 3, 4])

    expect(packed(long.subarray(1, 3)).byteLength).toBe(8)
  })

  it('answers nothing for bytes that are not whole floats', () => {
    expect([...unpacked(new Uint8Array([1, 2, 3]))]).toEqual([])
  })
})

describe('what identifies what was embedded', () => {
  it('joins both halves of a memory', () => {
    expect(embeddedTextOf('the rail', 'Scripts/Cam.ts drives it')).toBe(
      'the rail\nScripts/Cam.ts drives it',
    )
  })

  it('leaves no trailing newline for a memory with no body', () => {
    expect(embeddedTextOf('the rail', '')).toBe('the rail')
  })

  it('answers the same digest for the same words and a different one otherwise', () => {
    expect(digestOf('the rail')).toBe(digestOf('the rail'))
    expect(digestOf('the rail')).not.toBe(digestOf('the rails'))
  })
})

import { describe, expect, it } from 'vitest'
import { BRUSH_SIZE, DEFAULT_BRUSH, resizedBrush } from './brush'

describe('stepping the brush size', () => {
  it('grows and shrinks by a ratio, so a step feels the same at either end of the scale', () => {
    // A fixed number of pixels would crawl at 400 and leap at 4.
    expect(resizedBrush(DEFAULT_BRUSH, 'larger').size).toBe(34)
    expect(resizedBrush(DEFAULT_BRUSH, 'smaller').size).toBe(17)
  })

  it('comes back where it started after a step each way', () => {
    const grown = resizedBrush(DEFAULT_BRUSH, 'larger')

    expect(resizedBrush(grown, 'smaller').size).toBe(DEFAULT_BRUSH.size)
  })

  /**
   * The ratio rounds to a standstill at the bottom of the scale: a 1 px brush asked to grow by
   * √2 rounds back to 1, and the key would look broken exactly where the steps matter most.
   */
  it('always moves by at least one pixel', () => {
    expect(resizedBrush({ ...DEFAULT_BRUSH, size: 1 }, 'larger').size).toBe(2)
    expect(resizedBrush({ ...DEFAULT_BRUSH, size: 2 }, 'smaller').size).toBe(1)
    expect(resizedBrush({ ...DEFAULT_BRUSH, size: 3 }, 'smaller').size).toBe(2)
  })

  it('stops at both ends rather than wrapping or running away', () => {
    expect(resizedBrush({ ...DEFAULT_BRUSH, size: BRUSH_SIZE.min }, 'smaller').size).toBe(
      BRUSH_SIZE.min,
    )
    expect(resizedBrush({ ...DEFAULT_BRUSH, size: BRUSH_SIZE.max }, 'larger').size).toBe(
      BRUSH_SIZE.max,
    )
  })

  it('lands exactly on the ceiling rather than overshooting it', () => {
    const near = resizedBrush({ ...DEFAULT_BRUSH, size: BRUSH_SIZE.max - 1 }, 'larger')

    expect(near.size).toBe(BRUSH_SIZE.max)
  })

  it('leaves every other setting of the brush alone', () => {
    const tuned = { ...DEFAULT_BRUSH, hardness: 0.2, opacity: 0.5, color: 0xff0000 }
    const stepped = resizedBrush(tuned, 'larger')

    expect(stepped).toEqual({ ...tuned, size: stepped.size })
  })

  // A size that arrives from a restored session, or from a hand-edited document.
  it('drags a size from outside the scale back onto it', () => {
    expect(resizedBrush({ ...DEFAULT_BRUSH, size: 9000 }, 'larger').size).toBe(BRUSH_SIZE.max)
    expect(resizedBrush({ ...DEFAULT_BRUSH, size: 0 }, 'smaller').size).toBe(BRUSH_SIZE.min)
  })
})

describe('the brush the studio opens on', () => {
  it('sits inside its own scale', () => {
    expect(DEFAULT_BRUSH.size).toBeGreaterThanOrEqual(BRUSH_SIZE.min)
    expect(DEFAULT_BRUSH.size).toBeLessThanOrEqual(BRUSH_SIZE.max)
  })
})

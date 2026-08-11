import { describe, expect, it } from 'vitest'
import { rulerStep, tickLabel, ticks } from './rulers'

describe('rulerStep', () => {
  it('keeps majors readable at 100%', () => {
    expect(rulerStep(1)).toEqual({ major: 100, minor: 20 })
  })

  it('widens the step as the document shrinks', () => {
    expect(rulerStep(0.1).major).toBe(1000)
    expect(rulerStep(0.01).major).toBe(10000)
  })

  it('tightens it as the document is magnified', () => {
    expect(rulerStep(8).major).toBe(10)
    expect(rulerStep(64).major).toBe(2)
  })

  it('never draws majors closer than the labels need', () => {
    for (const scale of [0.02, 0.05, 0.37, 1, 2.5, 13, 64]) {
      expect(rulerStep(scale).major * scale).toBeGreaterThanOrEqual(72)
    }
  })

  it('cuts a major into minors that land on it', () => {
    for (const scale of [0.02, 0.1, 1, 4, 64]) {
      const step = rulerStep(scale)
      expect(step.major / step.minor).toBeCloseTo(Math.round(step.major / step.minor))
    }
  })
})

describe('ticks', () => {
  it('lists the multiples inside the range, bounds included', () => {
    expect(ticks(-10, 20, 10)).toEqual([-10, 0, 10, 20])
  })

  it('is empty when the range is inverted or the step absurd', () => {
    expect(ticks(20, 10, 5)).toEqual([])
    expect(ticks(0, 10, 0)).toEqual([])
  })

  it('refuses to emit more ticks than a frame can draw', () => {
    expect(ticks(0, 1_000_000, 1)).toEqual([])
  })
})

describe('tickLabel', () => {
  it('drops the decimals of a whole step', () => {
    expect(tickLabel(250, 50, 'en')).toBe('250')
  })

  it('keeps enough decimals for a fractional step to be distinguishable', () => {
    expect(tickLabel(0.5, 0.5, 'en')).toBe('0.5')
    expect(tickLabel(1, 0.5, 'en')).toBe('1.0')
  })

  it('never prints a negative zero', () => {
    expect(tickLabel(0, 0.5, 'en')).toBe('0.0')
  })

  // A graduation is read by the same person as the inspector beside it, which writes `0,5`.
  it('graduates in the language the window is in', () => {
    expect(tickLabel(0.5, 0.5, 'fr')).toBe('0,5')
    expect(tickLabel(1, 0.5, 'fr')).toBe('1,0')
  })

  /**
   * Ungrouped, unlike every other number the window writes: two majors sit 72 px apart at the
   * closest, and `1 000` there reads as two ticks rather than one.
   */
  it('leaves a thousand ungrouped, where a separator would read as a second tick', () => {
    expect(tickLabel(1000, 50, 'fr')).toBe('1000')
    expect(tickLabel(1000, 50, 'en')).toBe('1000')
  })
})

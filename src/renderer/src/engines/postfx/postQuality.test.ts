import { describe, expect, it } from 'vitest'
import { budgetFor, chainSize, samplesOf } from './postQuality'

/**
 * The one place the speed/definition trade is decided. An effect choosing its own resolution
 * would make the setting unpredictable, which § 18 forbids more firmly than it asks for speed.
 */
describe('what a composition is allowed to spend', () => {
  it('spends everything at the top setting, whatever it holds', () => {
    expect(budgetFor('high', 'high')).toEqual({ divisor: 1, samples: 1 })
  })

  it('never downscales a stack of cheap effects — there would be nothing to save', () => {
    expect(budgetFor('low', 'performance')).toEqual({ divisor: 1, samples: 0.6 })
    expect(budgetFor(null, 'performance')).toEqual({ divisor: 1, samples: 1 })
  })

  it('takes samples before pixels: definition goes last', () => {
    expect(budgetFor('high', 'balanced')).toEqual({ divisor: 1, samples: 0.6 })
    expect(budgetFor('high', 'performance')).toEqual({ divisor: 2, samples: 0.4 })
  })
})

describe('the arithmetic a budget drives', () => {
  it('halves the chain where the budget says so, and never below one pixel', () => {
    expect(chainSize(1920, 1080, { divisor: 2, samples: 1 })).toEqual({ width: 960, height: 540 })
    expect(chainSize(1, 1, { divisor: 2, samples: 1 })).toEqual({ width: 1, height: 1 })
  })

  it('cuts a sample count, and never below one sample', () => {
    expect(samplesOf(16, { divisor: 1, samples: 0.4 })).toBe(6)
    expect(samplesOf(1, { divisor: 1, samples: 0.4 })).toBe(1)
  })
})

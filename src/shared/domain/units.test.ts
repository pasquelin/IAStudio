import { describe, expect, it } from 'vitest'
import { DISPLAY_UNITS } from './scene'
import { displayStep, fromDisplayLength, toDisplayLength } from './units'

describe('lengths as they are written', () => {
  it('leaves a metre alone, which is what one scene unit is', () => {
    expect(toDisplayLength(2.5, 'm')).toBe(2.5)
  })

  it('spells the same length in each unit', () => {
    expect(toDisplayLength(1, 'cm')).toBe(100)
    expect(toDisplayLength(1, 'mm')).toBe(1000)
  })

  // The whole promise of the setting: it changes the figure shown, never what the document holds.
  it('gives back exactly what it was handed, in every unit', () => {
    for (const unit of DISPLAY_UNITS) {
      expect(fromDisplayLength(toDisplayLength(1.234, unit), unit)).toBeCloseTo(1.234, 10)
    }
  })

  it('steps by a coarser figure once the unit is a small one', () => {
    expect(displayStep('m')).toBeLessThan(1)
    expect(displayStep('mm')).toBe(1)
  })
})

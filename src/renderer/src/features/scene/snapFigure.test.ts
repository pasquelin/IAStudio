import { describe, expect, it } from 'vitest'
import { snapFigure } from './snapFigure'

describe('snapFigure', () => {
  // The bar showing metres beside an inspector showing millimetres would be two readings of one
  // number, and neither would look wrong on its own.
  it('turns a length into the unit the document is written in', () => {
    expect(snapFigure(0.5, 'length', 'm', 'en')).toBe('0.5')
    expect(snapFigure(0.5, 'length', 'cm', 'en')).toBe('50')
    expect(snapFigure(0.5, 'length', 'mm', 'en')).toBe('500')
  })

  // An angle is degrees whatever a length is written in, and a ratio is a plain number.
  it('leaves an angle and a ratio in their own terms', () => {
    expect(snapFigure(15, 'angle', 'mm', 'en')).toBe('15')
    expect(snapFigure(0.03125, 'ratio', 'mm', 'en')).toBe('0.03125')
  })

  it('keeps the finest value of each list rather than rounding it away', () => {
    expect(snapFigure(2.812, 'angle', 'm', 'en')).toBe('2.812')
    expect(snapFigure(0.01, 'length', 'm', 'en')).toBe('0.01')
  })
})

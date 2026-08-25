import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useSnapReading } from './useSnapReading'

/**
 * Every figure the snap bar shows passes through here — the closed value, the cells of its menus,
 * and the widest reading each control holds room for. Nothing else covers it: a unit keyed to the
 * wrong symbol, or a kind pointed at another kind's pattern, leaves `typecheck`, `known-keys` and
 * every bundle guard green, because all the keys involved exist on both sides.
 */
describe('useSnapReading', () => {
  const reading = (unit: 'mm' | 'cm' | 'm') => renderHook(() => useSnapReading(unit)).result.current

  it('writes a length in the unit the document is written in', () => {
    expect(reading('m')('length', 0.5)).toBe('0,5 m')
    expect(reading('cm')('length', 0.5)).toBe('50 cm')
    expect(reading('mm')('length', 0.5)).toBe('500 mm')
  })

  // An angle is degrees whatever a length is written in, and a ratio wears no unit at all.
  it('leaves an angle and a ratio out of the display unit', () => {
    expect(reading('mm')('angle', 15)).toBe('15°')
    expect(reading('mm')('ratio', 0.1)).toBe('×0,1')
  })

  it('keeps the finest value of each list rather than rounding it away', () => {
    expect(reading('m')('angle', 2.812)).toBe('2,812°')
    expect(reading('m')('ratio', 0.03125)).toBe('×0,03125')
  })
})

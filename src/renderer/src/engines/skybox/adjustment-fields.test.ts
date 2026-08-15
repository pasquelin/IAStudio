import { describe, expect, it } from 'vitest'
import { NEUTRAL_ADJUSTMENTS } from '@shared/domain/adjustments'
import { ADJUSTMENT_FIELDS } from './adjustment-fields'

describe('the adjustment fields', () => {
  it('covers every field of the stack — a missing one is a control nobody can reach', () => {
    const described = ADJUSTMENT_FIELDS.map(field => field.key).sort()
    expect(described).toEqual(Object.keys(NEUTRAL_ADJUSTMENTS).sort())
  })

  it('never describes the same field twice', () => {
    const keys = ADJUSTMENT_FIELDS.map(field => field.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('brackets the neutral value, so a slider can always return to it', () => {
    for (const field of ADJUSTMENT_FIELDS) {
      const neutral = NEUTRAL_ADJUSTMENTS[field.key]
      expect(neutral).toBeGreaterThanOrEqual(field.min)
      expect(neutral).toBeLessThanOrEqual(field.max)
    }
  })

  it('lands exactly on the neutral value at some step of the range', () => {
    for (const field of ADJUSTMENT_FIELDS) {
      const steps = (NEUTRAL_ADJUSTMENTS[field.key] - field.min) / field.step
      expect(Math.abs(steps - Math.round(steps))).toBeLessThan(1e-6)
    }
  })

  it('gives every field a usable range and a positive step', () => {
    for (const field of ADJUSTMENT_FIELDS) {
      expect(field.max).toBeGreaterThan(field.min)
      expect(field.step).toBeGreaterThan(0)
    }
  })

  it('names an i18n key rather than a label', () => {
    for (const field of ADJUSTMENT_FIELDS) expect(field.labelKey).toMatch(/^skybox\./)
  })
})

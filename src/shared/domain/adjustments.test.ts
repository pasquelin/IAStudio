import { describe, expect, it } from 'vitest'
import { isNeutral, NEUTRAL_ADJUSTMENTS, type AdjustmentStack } from './adjustments'

describe('the neutral stack', () => {
  it('is neutral', () => {
    expect(isNeutral(NEUTRAL_ADJUSTMENTS)).toBe(true)
  })

  it('leaves a copy neutral', () => {
    expect(isNeutral({ ...NEUTRAL_ADJUSTMENTS })).toBe(true)
  })

  it('multiplies exposure and contrast by one, not by zero', () => {
    expect(NEUTRAL_ADJUSTMENTS.exposure).toBe(0)
    expect(NEUTRAL_ADJUSTMENTS.contrast).toBe(1)
    expect(NEUTRAL_ADJUSTMENTS.saturation).toBe(1)
  })
})

describe('detecting a touched stack', () => {
  const touched = (patch: Partial<AdjustmentStack>): AdjustmentStack => ({
    ...NEUTRAL_ADJUSTMENTS,
    ...patch,
  })

  it('notices every field on its own — a missed one would bake a silent change', () => {
    expect(isNeutral(touched({ exposure: 0.1 }))).toBe(false)
    expect(isNeutral(touched({ contrast: 1.1 }))).toBe(false)
    expect(isNeutral(touched({ saturation: 0.9 }))).toBe(false)
    expect(isNeutral(touched({ temperature: -0.2 }))).toBe(false)
    expect(isNeutral(touched({ tint: 0.2 }))).toBe(false)
    expect(isNeutral(touched({ rotationY: 0.01 }))).toBe(false)
    expect(isNeutral(touched({ blur: 0.05 }))).toBe(false)
  })

  it('treats a rotation of a full turn as a change, since the shader will apply it', () => {
    expect(isNeutral(touched({ rotationY: Math.PI * 2 }))).toBe(false)
  })
})

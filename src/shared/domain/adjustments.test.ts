import { describe, expect, it } from 'vitest'
import {
  adjustUniformsOf,
  isNeutral,
  NEUTRAL_ADJUSTMENTS,
  type AdjustmentStack,
} from './adjustments'

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

describe('the uniforms a neutral stack becomes', () => {
  it('multiplies by one everywhere it multiplies', () => {
    const uniforms = adjustUniformsOf(NEUTRAL_ADJUSTMENTS)
    expect(uniforms.exposure).toBe(1)
    expect(uniforms.contrast).toBe(1)
    expect(uniforms.saturation).toBe(1)
  })

  it('adds nothing where it adds', () => {
    const uniforms = adjustUniformsOf(NEUTRAL_ADJUSTMENTS)
    expect(uniforms.temperature).toBe(0)
    expect(uniforms.tint).toBe(0)
    expect(uniforms.offsetU).toBe(0)
  })
})

describe('exposure in stops', () => {
  it('doubles the light for every stop up', () => {
    expect(adjustUniformsOf({ ...NEUTRAL_ADJUSTMENTS, exposure: 1 }).exposure).toBe(2)
    expect(adjustUniformsOf({ ...NEUTRAL_ADJUSTMENTS, exposure: 2 }).exposure).toBe(4)
  })

  it('halves it for every stop down', () => {
    expect(adjustUniformsOf({ ...NEUTRAL_ADJUSTMENTS, exposure: -1 }).exposure).toBe(0.5)
    expect(adjustUniformsOf({ ...NEUTRAL_ADJUSTMENTS, exposure: -2 }).exposure).toBe(0.25)
  })

  it('never reaches zero at the bottom of the range', () => {
    expect(adjustUniformsOf({ ...NEUTRAL_ADJUSTMENTS, exposure: -4 }).exposure).toBeGreaterThan(0)
  })
})

describe('horizon rotation as a texture offset', () => {
  it('turns a full turn into a full width', () => {
    expect(adjustUniformsOf({ ...NEUTRAL_ADJUSTMENTS, rotationY: Math.PI * 2 }).offsetU).toBe(1)
  })

  it('turns a half turn into half the width', () => {
    expect(adjustUniformsOf({ ...NEUTRAL_ADJUSTMENTS, rotationY: Math.PI }).offsetU).toBe(0.5)
  })

  it('keeps the sign, so turning back is turning back', () => {
    expect(adjustUniformsOf({ ...NEUTRAL_ADJUSTMENTS, rotationY: -Math.PI }).offsetU).toBe(-0.5)
  })
})

describe('temperature and tint', () => {
  it('scales them down, or a full swing would drive a channel to black', () => {
    const warm = adjustUniformsOf({ ...NEUTRAL_ADJUSTMENTS, temperature: 1, tint: 1 })
    expect(warm.temperature).toBeGreaterThan(0)
    expect(warm.temperature).toBeLessThan(1)
    expect(warm.tint).toBeGreaterThan(0)
    expect(warm.tint).toBeLessThan(1)
  })

  it('keeps a cold cast the mirror of a warm one', () => {
    const warm = adjustUniformsOf({ ...NEUTRAL_ADJUSTMENTS, temperature: 1 }).temperature
    const cold = adjustUniformsOf({ ...NEUTRAL_ADJUSTMENTS, temperature: -1 }).temperature
    expect(cold).toBe(-warm)
  })
})

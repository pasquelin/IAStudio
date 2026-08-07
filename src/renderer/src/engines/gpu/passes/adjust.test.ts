import { describe, expect, it } from 'vitest'
import { NEUTRAL_ADJUSTMENTS } from '@shared/domain/adjustments'
import { adjustUniformsOf, createAdjustPass } from './adjust'

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

describe('the pass itself', () => {
  it('starts neutral, so a source posted before any adjustment shows as it is', () => {
    const pass = createAdjustPass()
    expect(pass.uniforms.uExposure.value).toBe(1)
    expect(pass.uniforms.uContrast.value).toBe(1)
    expect(pass.uniforms.uSource.value).toBeNull()
    pass.dispose()
  })

  it('pushes a stack into its uniforms', () => {
    const pass = createAdjustPass()
    pass.setAdjustments({ ...NEUTRAL_ADJUSTMENTS, exposure: 2, saturation: 0 })
    expect(pass.uniforms.uExposure.value).toBe(4)
    expect(pass.uniforms.uSaturation.value).toBe(0)
    pass.dispose()
  })

  it('hands the material the very uniform objects it exposes', () => {
    const pass = createAdjustPass()
    expect(pass.material.uniforms.uExposure).toBe(pass.uniforms.uExposure)
    pass.dispose()
  })

  it('declares every uniform its fragment shader reads', () => {
    const pass = createAdjustPass()
    const declared = Object.keys(pass.uniforms)
    const read = [...pass.material.fragmentShader.matchAll(/uniform \w+ (\w+);/g)].map(m => m[1])

    expect(read.length).toBeGreaterThan(0)
    for (const name of read) expect(declared).toContain(name)
    pass.dispose()
  })
})

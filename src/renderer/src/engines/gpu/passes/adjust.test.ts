import { describe, expect, it } from 'vitest'
import { NEUTRAL_ADJUSTMENTS } from '@shared/domain/adjustments'
import { createAdjustPass } from './adjust'

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

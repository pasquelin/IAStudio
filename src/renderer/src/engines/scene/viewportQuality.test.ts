import { describe, expect, it } from 'vitest'
import { VIEWPORT_QUALITIES } from '@shared/domain/scene'
import { pixelRatioFor, shadowMapSizeFor } from './viewportQuality'

describe('viewport quality', () => {
  it('buys more pixels at every step up', () => {
    const ratios = VIEWPORT_QUALITIES.map(pixelRatioFor)

    expect(ratios).toEqual([...ratios].sort((left, right) => left - right))
    expect(new Set(ratios).size).toBe(VIEWPORT_QUALITIES.length)
  })

  it('caps a shadow map rather than choosing one', () => {
    // Someone who asked for 1024 keeps 1024 on high, and is not silently given four times the
    // memory they chose.
    expect(shadowMapSizeFor('high', 1024)).toBe(1024)
    expect(shadowMapSizeFor('performance', 4096)).toBe(512)
    expect(shadowMapSizeFor('balanced', 4096)).toBe(2048)
  })
})

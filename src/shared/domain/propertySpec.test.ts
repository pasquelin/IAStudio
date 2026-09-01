import { describe, expect, it } from 'vitest'
import { ASSET_TYPES, type AssetType } from './asset'
import { numericBoundsOf, PROPERTY_ASSET_TYPES } from './propertySpec'

/**
 * The pair `propertySpec.ts` spells out rather than imports: reading `AssetType` from there would
 * close a cycle through `material.ts` and `scene.ts`, and `import-cycles.test.ts` counts a
 * type-only import like any other. A TEST may import both, since nothing imports a test.
 */
describe('the shelves a property field may point at', () => {
  it('names only real asset types', () => {
    const strayed = PROPERTY_ASSET_TYPES.filter(
      one => !ASSET_TYPES.some((type: AssetType) => type === one),
    )

    expect(strayed).toEqual([])
  })
})

describe('what a spec holds a number to', () => {
  it('answers the bounds of the two controls that have any', () => {
    expect(numericBoundsOf({ control: 'slider', min: 0, max: 1, step: 0.1 })).toEqual({
      control: 'slider',
      min: 0,
      max: 1,
      step: 0.1,
    })
    expect(numericBoundsOf({ control: 'number', min: 2, step: 1 })?.min).toBe(2)
  })

  it('answers nothing for a control that bounds nothing', () => {
    expect(numericBoundsOf({ control: 'color' })).toBeNull()
    expect(numericBoundsOf({ control: 'toggle' })).toBeNull()
    expect(numericBoundsOf(undefined)).toBeNull()
  })
})

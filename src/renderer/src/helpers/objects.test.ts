import { describe, expect, it } from 'vitest'
import { changedFields, sameValues } from './objects'

describe('changedFields', () => {
  it('is empty when nothing moved', () => {
    expect(changedFields({ x: 1, y: 2 }, { x: 1, y: 2 })).toEqual({})
  })

  it('keeps only the fields that differ', () => {
    expect(changedFields({ x: 1, y: 2, z: 3 }, { x: 1, y: 9, z: 3 })).toEqual({ y: 9 })
  })

  it('reports a field set to null or to zero rather than treating it as absent', () => {
    expect(changedFields({ map: { id: 'a' } }, { map: null })).toEqual({ map: null })
    expect(changedFields({ x: 1 }, { x: 0 })).toEqual({ x: 0 })
  })

  // `Object.is` rather than `!==`: NaN is what an emptied numeric field reports, and a field
  // that stayed NaN has not moved.
  it('reads NaN as unchanged and the two zeroes as different', () => {
    expect(changedFields({ x: NaN }, { x: NaN })).toEqual({})
    expect(changedFields({ x: 0 }, { x: -0 })).toEqual({ x: -0 })
  })

  // A control hands back a fresh object every time it is touched; only its contents matter here.
  it('compares by reference, so a rebuilt value counts as changed', () => {
    expect(changedFields({ at: { x: 1 } }, { at: { x: 1 } })).toEqual({ at: { x: 1 } })
  })
})

/**
 * The complement of `changedFields`, and the reason it exists: a material read back from a file
 * has to be comparable to the style it came from, and its tiling is a nested object.
 */
describe('sameValues', () => {
  it('reads two structurally equal objects as the same, however they were built', () => {
    expect(sameValues({ tiling: { x: 1, y: 2 } }, { tiling: { x: 1, y: 2 } })).toBe(true)
  })

  it('separates them on any field, however deep', () => {
    expect(sameValues({ tiling: { x: 1, y: 2 } }, { tiling: { x: 1, y: 3 } })).toBe(false)
  })

  /** A style holding fewer settings than the material is not that material. */
  it('refuses an object that holds fewer fields, or more', () => {
    expect(sameValues({ x: 1, y: 2 }, { x: 1 })).toBe(false)
    expect(sameValues({ x: 1 }, { x: 1, y: 2 })).toBe(false)
  })

  it('tells an array from the object holding the same keys', () => {
    expect(sameValues([1, 2], { 0: 1, 1: 2 })).toBe(false)
    expect(sameValues([1, 2], [1, 2])).toBe(true)
  })

  it('handles null and the primitives without walking into them', () => {
    expect(sameValues(null, null)).toBe(true)
    expect(sameValues(null, {})).toBe(false)
    expect(sameValues('#ffffff', '#ffffff')).toBe(true)
    expect(sameValues(1, '1')).toBe(false)
  })

  /** Same reason `changedFields` uses `Object.is`: an emptied numeric field reports NaN. */
  it('reads NaN as equal to itself', () => {
    expect(sameValues({ x: NaN }, { x: NaN })).toBe(true)
  })
})

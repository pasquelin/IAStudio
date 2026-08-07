import { describe, expect, it } from 'vitest'
import { bound, clamp, snap } from './numeric'

describe('clamp', () => {
  it('leaves a value inside its bounds alone', () => {
    expect(clamp(5, 0, 10)).toBe(5)
  })

  it('holds a value at the bound it crossed', () => {
    expect(clamp(-3, 0, 10)).toBe(0)
    expect(clamp(30, 0, 10)).toBe(10)
  })
})

describe('snap', () => {
  it('rounds to the nearest step', () => {
    expect(snap(0.37, 0.1)).toBe(0.4)
    expect(snap(7, 5)).toBe(5)
  })

  // Otherwise a dragged roughness reads 0.30000000000000004 in the field.
  it('leaves no binary tail behind', () => {
    expect(snap(0.1 + 0.2, 0.1)).toBe(0.3)
    expect(snap(1.1 * 3, 0.1)).toBe(3.3)
  })

  it('leaves the value alone when there is no step to snap to', () => {
    expect(snap(1.2345, 0)).toBe(1.2345)
  })
})

describe('bound', () => {
  it('snaps before it clamps', () => {
    expect(bound(0.44, { min: 0, max: 1, step: 0.1 })).toBe(0.4)
  })

  it('accepts a field with no bounds at all', () => {
    expect(bound(-1234.5, {})).toBe(-1234.5)
  })

  it('holds an out-of-range value at its bound', () => {
    expect(bound(4, { min: 0, max: 1, step: 0.01 })).toBe(1)
  })
})

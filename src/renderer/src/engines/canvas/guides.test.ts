import { describe, expect, it } from 'vitest'
import { DEFAULT_CANVAS, type Guide } from './canvas-state'
import { guideNear, snapTargets, snapValue } from './guides'

const GUIDES: Guide[] = [
  { id: 'a', axis: 'x', position: 300 },
  { id: 'b', axis: 'y', position: 120 },
]

describe('snapTargets', () => {
  it('offers the frame edges, its middle and the guides of that axis', () => {
    const state = { ...DEFAULT_CANVAS, width: 800, height: 600, guides: GUIDES }

    expect(snapTargets(state, 'x')).toEqual([0, 400, 800, 300])
    expect(snapTargets(state, 'y')).toEqual([0, 300, 600, 120])
  })
})

describe('snapValue', () => {
  it('sticks to a target within tolerance', () => {
    expect(snapValue(298, [0, 300], 6)).toBe(300)
  })

  it('leaves a value alone outside tolerance', () => {
    expect(snapValue(290, [0, 300], 6)).toBe(290)
  })

  it('takes the nearest of two candidates, not the first declared', () => {
    expect(snapValue(299, [296, 300], 6)).toBe(300)
  })
})

describe('guideNear', () => {
  it('finds the guide under the pointer on its own axis', () => {
    expect(guideNear(GUIDES, 'x', 302, 4)?.id).toBe('a')
  })

  it('ignores a guide of the other axis at the same coordinate', () => {
    expect(guideNear(GUIDES, 'y', 300, 4)).toBeNull()
  })

  it('returns nothing when the pointer is past the tolerance', () => {
    expect(guideNear(GUIDES, 'x', 310, 4)).toBeNull()
  })
})

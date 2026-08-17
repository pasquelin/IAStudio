import { describe, expect, it } from 'vitest'
import { frameDelta } from './frameClock'

const CAP = 0.1

describe('frameDelta', () => {
  it('reports an ordinary frame in seconds', () => {
    expect(frameDelta({ since: 16, cap: CAP })).toBeCloseTo(0.016)
  })

  // A fly step multiplies this: a viewport left alone for five seconds would otherwise move
  // the camera five seconds' worth on the very frame the user pressed a key.
  it('gives nothing to the first frame of a loop starting from rest', () => {
    expect(frameDelta({ since: null, cap: CAP })).toBe(0)
  })

  it('caps a frame that took longer than any frame should', () => {
    expect(frameDelta({ since: 5000, cap: CAP })).toBe(CAP)
    expect(frameDelta({ since: 200, cap: CAP })).toBe(CAP)
  })

  // A clock that steps backwards is not a reason to move the camera backwards.
  it('refuses a negative gap', () => {
    expect(frameDelta({ since: -20, cap: CAP })).toBe(0)
  })

  it('leaves a frame right on the cap alone', () => {
    expect(frameDelta({ since: 100, cap: CAP })).toBe(CAP)
  })
})

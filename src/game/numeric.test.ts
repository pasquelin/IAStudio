// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest'
import { clamp } from './numeric'

describe('clamp', () => {
  it('answers the bound a value passes, and the value between them', () => {
    expect(clamp(-2, 0, 1)).toBe(0)
    expect(clamp(4, 0, 1)).toBe(1)
    expect(clamp(0.25, 0, 1)).toBe(0.25)
  })

  it('carries a value no arithmetic can bound through', () => {
    expect(clamp(Number.NaN, 0, 1)).toBeNaN()
  })

  // The only thing that tells this apart from the studio's `clampAtLeast`, and what every caller
  // of this tree relies on without saying so: five of them were written the other way round.
  it('answers the CEILING when the bounds cross', () => {
    expect(clamp(5, 10, 0)).toBe(0)
  })
})

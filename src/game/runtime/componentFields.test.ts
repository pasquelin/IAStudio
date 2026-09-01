// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest'
import type { Component } from '@shared/domain/component'
import { flagOf, numberOf, textOf } from './componentFields'

const held: Component = {
  type: 'Movement',
  speed: 3,
  broken: Number.NaN,
  said: 'loop',
  on: true,
}

/**
 * The registry refuses a value that does not fit when one is WRITTEN. A document can be
 * hand-edited and a `.gltf` can come from elsewhere, so a system reads through this instead.
 */
describe('what a system reads off a component', () => {
  it('takes a number it can compute with, and falls back on anything else', () => {
    expect(numberOf(held, 'speed', 1)).toBe(3)
    expect(numberOf(held, 'broken', 1)).toBe(1)
    expect(numberOf(held, 'said', 1)).toBe(1)
    expect(numberOf(held, 'absent', 1)).toBe(1)
  })

  /** A caller that may not carry the component at all writes no ternary of its own. */
  it('falls back on nothing at all', () => {
    expect(numberOf(null, 'speed', 1)).toBe(1)
    expect(textOf(null, 'said', 'once')).toBe('once')
    expect(flagOf(null, 'on', true)).toBe(true)
  })

  it('takes a word and a switch the same way', () => {
    expect(textOf(held, 'said', 'once')).toBe('loop')
    expect(textOf(held, 'speed', 'once')).toBe('once')
    expect(flagOf(held, 'on', false)).toBe(true)
    expect(flagOf(held, 'said', false)).toBe(false)
  })
})

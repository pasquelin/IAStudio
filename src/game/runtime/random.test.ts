// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest'
import { createRandom } from './random'

const drawn = (seed: number, count: number): number[] => {
  const random = createRandom(seed)
  return Array.from({ length: count }, () => random.next())
}

describe('the generator a world draws from', () => {
  it('answers the same sequence for the same seed, and another for another', () => {
    expect(drawn(7, 5)).toEqual(drawn(7, 5))
    expect(drawn(7, 5)).not.toEqual(drawn(8, 5))
  })

  it('stays inside the unit interval', () => {
    const values = drawn(3, 500)

    expect(values.every(value => value >= 0 && value < 1)).toBe(true)
  })

  it('draws whole numbers under a bound, and nothing at all under none', () => {
    const random = createRandom(11)
    const values = Array.from({ length: 200 }, () => random.int(6))

    expect(values.every(value => Number.isInteger(value) && value >= 0 && value < 6)).toBe(true)
    expect(new Set(values).size).toBe(6)
    expect(createRandom(11).int(0)).toBe(0)
  })

  /** Four bytes carry it, which is what puts a world's luck in a save file or a network packet. */
  it('hands its state back as one number', () => {
    const random = createRandom(5)
    random.next()

    expect(Number.isInteger(random.state())).toBe(true)
    expect(random.state()).not.toBe(createRandom(5).state())
  })
})

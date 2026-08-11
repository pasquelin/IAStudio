import { describe, expect, it } from 'vitest'
import { SECOND, secondsToUs, usToSeconds } from './time'

describe('timeline time', () => {
  it('converts microseconds to the float seconds a media library speaks, and back', () => {
    expect(usToSeconds(1_500_000)).toBe(1.5)
    expect(secondsToUs(1.5)).toBe(1_500_000)
  })

  it('rounds to a whole microsecond rather than holding a fraction of one', () => {
    expect(secondsToUs(1 / 3)).toBe(333_333)
    expect(Number.isInteger(secondsToUs(0.0000004))).toBe(true)
  })

  it('makes a round trip through seconds exact on a frame of every usual rate', () => {
    for (const fps of [24, 25, 30, 50, 60]) {
      const frame = Math.round(SECOND / fps)
      expect(secondsToUs(usToSeconds(frame))).toBe(frame)
    }
  })
})

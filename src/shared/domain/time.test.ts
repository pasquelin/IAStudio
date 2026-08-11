import { describe, expect, it } from 'vitest'
import { SECOND, frameDuration, secondsToUs, snapToFrame, usToSeconds } from './time'

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

describe('the frame grid', () => {
  it('gives a whole number of microseconds even at a rate that does not divide a second', () => {
    expect(frameDuration(25)).toBe(40_000)
    expect(Number.isInteger(frameDuration(30))).toBe(true)
    expect(Number.isInteger(frameDuration(24))).toBe(true)
  })

  it('snaps a time to the nearest frame', () => {
    expect(snapToFrame(310_000, 25)).toBe(320_000)
    expect(snapToFrame(0, 25)).toBe(0)
  })

  it('never answers before the start, however far back the time is', () => {
    expect(snapToFrame(-5 * SECOND, 25)).toBe(0)
  })

  it('leaves a time already on the grid exactly where it stands', () => {
    const frame = frameDuration(30)
    expect(snapToFrame(frame * 7, 30)).toBe(frame * 7)
  })
})

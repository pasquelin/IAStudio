import { describe, expect, it } from 'vitest'
import { boundsOf } from '@shared/domain/settingsRegistry'
import { speedAfterWheel } from './flySpeed'

const { min, max } = boundsOf('three.flySpeed')

describe('spending the wheel on how fast one flies', () => {
  it('speeds up when the wheel goes forward', () => {
    expect(speedAfterWheel(4, 1)).toBeGreaterThan(4)
  })

  it('slows down when it goes back', () => {
    expect(speedAfterWheel(4, -1)).toBeLessThan(4)
  })

  it('holds to the same bounds the preference offers, so no flick outruns the slider', () => {
    expect(speedAfterWheel(max, 40)).toBe(max)
    expect(speedAfterWheel(min, -40)).toBe(min)
  })

  it('steps geometrically, so one wheel serves a room and a valley alike', () => {
    const slow = speedAfterWheel(1, 1) - 1
    const fast = speedAfterWheel(10, 1) - 10
    expect(fast).toBeGreaterThan(slow)
  })
})

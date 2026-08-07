import { describe, expect, it } from 'vitest'
import { createClock } from './clock'

describe('playback clock', () => {
  it('reads the audio clock when there is one: rAF drifts audibly within a minute', () => {
    let seconds = 10
    const clock = createClock({ audioTime: () => seconds, monotonic: () => 0 })

    clock.start(2_000_000)
    seconds = 10.5

    expect(clock.now()).toBe(2_500_000)
  })

  it('falls back to the monotonic clock when no audio context is playing', () => {
    let milliseconds = 1_000
    const clock = createClock({ audioTime: () => null, monotonic: () => milliseconds })

    clock.start(0)
    milliseconds = 1_250

    expect(clock.now()).toBe(250_000)
  })

  it('freezes at the last position once stopped', () => {
    let seconds = 0
    const clock = createClock({ audioTime: () => seconds, monotonic: () => 0 })

    clock.start(0)
    seconds = 1
    clock.stop()
    seconds = 5

    expect(clock.now()).toBe(1_000_000)
  })

  it('reports the position it was started from before any time passes', () => {
    const clock = createClock({ audioTime: () => 4, monotonic: () => 0 })
    clock.start(3_000_000)
    expect(clock.now()).toBe(3_000_000)
  })

  it('resumes from the new position when restarted', () => {
    let seconds = 0
    const clock = createClock({ audioTime: () => seconds, monotonic: () => 0 })

    clock.start(0)
    seconds = 2
    clock.stop()
    clock.start(10_000_000)
    seconds = 3

    expect(clock.now()).toBe(11_000_000)
  })

  it('holds at zero before it is ever started', () => {
    expect(createClock({ audioTime: () => 7, monotonic: () => 99 }).now()).toBe(0)
  })
})

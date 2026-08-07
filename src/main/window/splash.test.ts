import { describe, expect, it } from 'vitest'
import {
  createSplashController,
  SPLASH_MINIMUM_MS,
  SPLASH_TIMEOUT_MS,
  type SplashTiming,
} from './splash'

type Scheduled = { callback: () => void; delay: number; cancelled: boolean }

function fakeTiming(): {
  timing: SplashTiming
  scheduled: Scheduled[]
  advance: (ms: number) => void
} {
  const scheduled: Scheduled[] = []
  let clock = 0

  return {
    scheduled,
    advance: ms => {
      clock += ms
    },
    timing: {
      now: () => clock,
      schedule: (callback, delay) => {
        const entry: Scheduled = { callback, delay, cancelled: false }
        scheduled.push(entry)
        return () => {
          entry.cancelled = true
        }
      },
    },
  }
}

describe('createSplashController', () => {
  it('holds the splash for the floor when startup is instant', () => {
    const { timing, scheduled } = fakeTiming()
    let closed = 0
    const controller = createSplashController(timing, () => {
      closed += 1
    })

    controller.finish()
    expect(closed).toBe(0)

    const pending = scheduled.find(entry => entry.delay === SPLASH_MINIMUM_MS)
    expect(pending).toBeDefined()
    pending?.callback()
    expect(closed).toBe(1)
  })

  it('closes at once when startup already outlasted the floor', () => {
    const { timing, advance } = fakeTiming()
    let closed = 0
    const controller = createSplashController(timing, () => {
      closed += 1
    })

    advance(SPLASH_MINIMUM_MS + 1)
    controller.finish()
    expect(closed).toBe(1)
  })

  it('closes on its own if startup never reports, leaving no ghost window', () => {
    const { timing, scheduled } = fakeTiming()
    let closed = 0
    createSplashController(timing, () => {
      closed += 1
    })

    const safety = scheduled.find(entry => entry.delay === SPLASH_TIMEOUT_MS)
    expect(safety).toBeDefined()
    safety?.callback()
    expect(closed).toBe(1)
  })

  it('disarms the safety timer on a normal close', () => {
    // Left armed, it holds the window — and this whole scope — alive for twenty seconds,
    // exactly while the renderer needs the CPU.
    const { timing, scheduled, advance } = fakeTiming()
    const controller = createSplashController(timing, () => {})

    advance(SPLASH_MINIMUM_MS + 1)
    controller.finish()

    const safety = scheduled.find(entry => entry.delay === SPLASH_TIMEOUT_MS)
    expect(safety?.cancelled).toBe(true)
  })

  it('closes exactly once, whatever fires first', () => {
    const { timing, scheduled, advance } = fakeTiming()
    let closed = 0
    const controller = createSplashController(timing, () => {
      closed += 1
    })

    advance(SPLASH_MINIMUM_MS + 1)
    controller.finish()
    scheduled.forEach(entry => entry.callback())
    controller.finish()
    expect(closed).toBe(1)
  })
})

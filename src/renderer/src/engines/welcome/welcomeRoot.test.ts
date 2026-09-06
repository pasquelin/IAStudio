import { describe, expect, it } from 'vitest'
import { welcomeStepOver, type WelcomeRootMotion } from './welcomeRoot'

const DURATION = 1.067
const TRAVEL = 1.395

/** A clip that walks straight along +z at a steady rate, so a sum has an exact answer to meet. */
const steady: WelcomeRootMotion = {
  travelAt: time => ({ x: 0, z: (TRAVEL * Math.min(Math.max(time, 0), DURATION)) / DURATION }),
  heightAt: () => 0,
  turnAt: () => 0,
}

describe('welcomeStepOver', () => {
  it('covers a whole clip length per cycle, loops included', () => {
    let covered = 0
    let time = 0
    for (let frame = 0; frame < 180; frame += 1) {
      covered += welcomeStepOver(steady, DURATION, time, 1 / 60).z
      time = (time + 1 / 60) % DURATION
    }

    expect(covered).toBeCloseTo((3 * TRAVEL) / DURATION, 3)
  })

  it('pushes nothing once the clip is spent, which is where a crossfade holds it', () => {
    expect(welcomeStepOver(steady, DURATION, DURATION, 1 / 60)).toEqual({ x: 0, z: 0, turned: 0 })
    expect(welcomeStepOver(steady, DURATION, DURATION + 0.2, 1 / 60)).toEqual({
      x: 0,
      z: 0,
      turned: 0,
    })
  })
})

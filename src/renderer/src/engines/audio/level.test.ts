import { describe, expect, it } from 'vitest'
import { toDb } from './audio-data'
import { CLIP_AMPLITUDE, CLIP_DB, HOT_AMPLITUDE, HOT_DB, SCALE_DB } from './level'

describe('the level scale', () => {
  it('reads its thresholds back as the decibels they were written in', () => {
    expect(toDb(HOT_AMPLITUDE)).toBeCloseTo(HOT_DB, 6)
    expect(toDb(CLIP_AMPLITUDE)).toBeCloseTo(CLIP_DB, 6)
  })

  it('puts full scale at an amplitude of one, where a sample stops fitting', () => {
    expect(CLIP_AMPLITUDE).toBe(1)
    expect(HOT_AMPLITUDE).toBeLessThan(CLIP_AMPLITUDE)
  })

  it('graduates downward from the hot threshold, so a monitor draws them in order', () => {
    expect(SCALE_DB[0]).toBe(HOT_DB)
    expect([...SCALE_DB].sort((left, right) => right - left)).toEqual(SCALE_DB)
    expect(SCALE_DB.every(db => db < CLIP_DB)).toBe(true)
  })
})

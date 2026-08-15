import { describe, expect, it } from 'vitest'
import { fromDb, toDb } from './audio-data'
import {
  CLIP_AMPLITUDE,
  CLIP_DB,
  FLOOR_DB,
  HOT_AMPLITUDE,
  HOT_DB,
  levelAtFraction,
  levelOf,
  meterFraction,
  meterFrom,
  peakOf,
  RESTING_METER,
  SCALE_DB,
} from './level'

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

  it('reads a trough exactly as it reads a crest', () => {
    expect(levelOf(-1)).toBe('clip')
    expect(levelOf(-0.7)).toBe('hot')
    expect(levelOf(-0.1)).toBe('safe')
  })

  it('turns hot at its threshold, not a hair before', () => {
    expect(levelOf(fromDb(HOT_DB))).toBe('hot')
    expect(levelOf(fromDb(HOT_DB - 0.1))).toBe('safe')
    // Past full scale: a sum of clips reaches beyond what a single sample ever holds.
    expect(levelOf(1.4)).toBe('clip')
  })
})

describe('the meter scale', () => {
  /**
   * Decibels, never amplitude. Half the amplitude is six decibels: a linear bar would spend nine
   * tenths of its height on the loudest six of a forty-eight decibel range, and show a quiet
   * passage as no bar at all.
   */
  it('spreads the scale evenly in decibels between its floor and full scale', () => {
    expect(meterFraction(1)).toBe(1)
    expect(meterFraction(fromDb(FLOOR_DB / 2))).toBeCloseTo(0.5, 6)
    expect(meterFraction(fromDb(HOT_DB))).toBeCloseTo(1 - HOT_DB / FLOOR_DB, 6)
  })

  /**
   * An analyser bin arrives as a point on this scale, not as an amplitude. Read as one, a bass
   * bin sitting fifty decibels under the ceiling came out amber — the fraction 0.6 looking like
   * an amplitude of 0.6, which is very nearly hot.
   */
  it('reads a point on the scale by the decibels it stands at, not by its number', () => {
    expect(levelAtFraction(meterFraction(fromDb(HOT_DB)))).toBe('hot')
    expect(levelAtFraction(1)).toBe('clip')
    expect(levelAtFraction(0)).toBe('safe')
    // The very reading that was wrong: six tenths up a −48 dB scale is −19 dB, nowhere near hot.
    expect(levelAtFraction(0.6)).toBe('safe')
  })

  it('bottoms out at silence rather than falling off the scale', () => {
    expect(meterFraction(0)).toBe(0)
    expect(meterFraction(fromDb(FLOOR_DB))).toBe(0)
    expect(meterFraction(fromDb(FLOOR_DB - 20))).toBe(0)
    // And a sum louder than one sample can hold still reads full, never past it.
    expect(meterFraction(1.5)).toBe(1)
  })
})

describe('the meter', () => {
  it('takes the loudest sample of a window, whichever side of the axis it fell', () => {
    expect(peakOf(new Float32Array([0.1, -0.8, 0.3]))).toBeCloseTo(0.8, 6)
    expect(peakOf(new Float32Array())).toBe(0)
  })

  /** What a meter is for: the transient that was about to be missed, caught the frame it happens. */
  it('rises to a sound the instant it arrives', () => {
    expect(meterFrom(0.9, RESTING_METER, 1).level).toBeCloseTo(0.9, 6)
  })

  /**
   * And falls slowly. A bar that fell as fast as the signal would flicker rather than show a
   * level: music is mostly silence between transients.
   */
  it('falls back at twenty decibels a second once the sound has gone', () => {
    const struck = meterFrom(1, RESTING_METER, 1)
    const later = meterFrom(0, struck, 2)

    expect(toDb(later.level)).toBeCloseTo(-20, 4)
    expect(later.level).toBeLessThan(struck.level)
  })

  it('leaves the witness standing where the sound put it, then lets it follow', () => {
    const struck = meterFrom(1, RESTING_METER, 1)
    const soonAfter = meterFrom(0, struck, 2)
    const wellAfter = meterFrom(0, soonAfter, 3)

    expect(soonAfter.peak).toBe(1)
    expect(soonAfter.peakAt).toBe(1)
    // A second and a half gone by: it drops to the bar rather than hanging on for good.
    expect(wellAfter.peak).toBeCloseTo(wellAfter.level, 6)
  })

  it('latches an overload, so one frame at full scale is not missed between two glances', () => {
    const clipped = meterFrom(1, RESTING_METER, 1)

    expect(clipped.clipped).toBe(true)
    expect(meterFrom(0, clipped, 5).clipped).toBe(true)
    // And rearming is the caller's move, not something a quiet passage does on its own.
    expect(RESTING_METER.clipped).toBe(false)
  })
})

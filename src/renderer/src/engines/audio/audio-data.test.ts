import { describe, expect, it } from 'vitest'
import {
  applyFades,
  applyGain,
  crop,
  durationOf,
  edgeSilences,
  frameCount,
  framesFor,
  normalize,
  rms,
  toDb,
  trimSilence,
  type AudioData,
} from './audio-data'

/** A second of sound at a round rate: one hundred frames a second keeps the arithmetic legible. */
const RATE = 100

const tone = (frames: number, level = 0.5, channels = 1): AudioData => ({
  sampleRate: RATE,
  channels: Array.from({ length: channels }, () => new Float32Array(frames).fill(level)),
})

describe('measuring', () => {
  it('reads a duration from the frame count and the rate', () => {
    expect(durationOf(tone(150))).toBe(1_500_000)
    expect(frameCount(tone(150))).toBe(150)
  })

  it('converts a time to frames', () => {
    expect(framesFor(1_000_000, RATE)).toBe(100)
    expect(framesFor(-5, RATE)).toBe(0)
  })

  it('reads a flat tone as its own level', () => {
    expect(rms(tone(100, 0.5))).toBeCloseTo(0.5)
    expect(toDb(0.5)).toBeCloseTo(-6.02, 1)
  })

  it('reads silence as no level at all, rather than as negative infinity everywhere', () => {
    expect(rms(tone(100, 0))).toBe(0)
    expect(toDb(0)).toBe(-Infinity)
  })
})

describe('cropping', () => {
  it('keeps the range it was given', () => {
    expect(frameCount(crop(tone(200), 500_000, 1_500_000))).toBe(100)
  })

  it('clamps a range that runs past the end', () => {
    expect(frameCount(crop(tone(100), 0, 9_000_000))).toBe(100)
  })

  it('yields silence for an inverted range rather than throwing', () => {
    expect(frameCount(crop(tone(100), 900_000, 100_000))).toBe(0)
  })

  it('crops every channel alike', () => {
    expect(crop(tone(200, 0.5, 2), 0, 1_000_000).channels.map(c => c.length)).toEqual([100, 100])
  })
})

describe('fades', () => {
  it('rises from silence and falls back to it', () => {
    const faded = applyFades(tone(100, 1), 200_000, 200_000)
    const channel = faded.channels[0]!

    expect(channel[0]).toBe(0)
    expect(channel[10]).toBeCloseTo(0.5)
    expect(channel[50]).toBe(1)
    expect(channel[99]).toBeCloseTo(0, 1)
  })

  it('leaves the source untouched, so a chain can be replayed from it', () => {
    const source = tone(100, 1)
    applyFades(source, 200_000, 0)
    expect(source.channels[0]?.[0]).toBe(1)
  })

  it('shares the take when there is no ramp to apply', () => {
    const source = tone(100, 1)
    expect(applyFades(source, 0, 0)).toBe(source)
  })

  it('never lets two ramps overlap and raise the middle', () => {
    const faded = applyFades(tone(100, 1), 800_000, 800_000)
    expect(faded.channels[0]?.[50]).toBeLessThanOrEqual(1)
  })
})

describe('gain', () => {
  it('doubles the level six decibels up', () => {
    expect(applyGain(tone(10, 0.25), 6.02).channels[0]?.[0]).toBeCloseTo(0.5, 2)
  })

  it('clamps rather than wrapping, which would be heard as a crackle', () => {
    expect(applyGain(tone(10, 0.9), 24).channels[0]?.[0]).toBe(1)
  })

  it('shares the take when there is nothing to change', () => {
    const source = tone(10, 0.5)
    expect(applyGain(source, 0)).toBe(source)
  })
})

describe('normalising', () => {
  it('brings a quiet take up to the target', () => {
    const loud = normalize(tone(100, 0.05), -14)
    expect(toDb(rms(loud))).toBeCloseTo(-14, 1)
  })

  it('brings a loud take down to it', () => {
    const quieter = normalize(tone(100, 0.9), -14)
    expect(toDb(rms(quieter))).toBeCloseTo(-14, 1)
  })

  it('leaves silence alone rather than multiplying it by infinity', () => {
    const silent = tone(100, 0)
    expect(normalize(silent)).toBe(silent)
  })
})

describe('silences', () => {
  const withEdges = (): AudioData => {
    const channel = new Float32Array(300)
    // A second of sound in the middle, a second of silence on each side.
    for (let frame = 100; frame < 200; frame++) channel[frame] = 0.5
    return { sampleRate: RATE, channels: [channel] }
  }

  it('finds the quiet stretch at each end', () => {
    expect(edgeSilences(withEdges())).toEqual([
      { from: 0, to: 1_000_000 },
      { from: 2_000_000, to: 3_000_000 },
    ])
  })

  it('ignores a gap too short to be worth calling silence', () => {
    const channel = new Float32Array(300).fill(0.5)
    channel[0] = 0
    expect(edgeSilences({ sampleRate: RATE, channels: [channel] })).toEqual([])
  })

  it('leaves the middle alone, which is where the beat lives', () => {
    const channel = new Float32Array(300).fill(0.5)
    for (let frame = 100; frame < 200; frame++) channel[frame] = 0
    expect(edgeSilences({ sampleRate: RATE, channels: [channel] })).toEqual([])
  })

  it('cuts both ends off', () => {
    expect(frameCount(trimSilence(withEdges()))).toBe(100)
  })

  it('shares a take that has nothing to cut', () => {
    const source = tone(300, 0.5)
    expect(trimSilence(source)).toBe(source)
  })

  it('reads a take that is silent throughout as silence at the head, and keeps nothing', () => {
    expect(frameCount(trimSilence(tone(300, 0)))).toBe(0)
  })
})

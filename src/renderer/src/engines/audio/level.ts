import { clamp } from '@shared/numeric'
import { fromDb, toDb } from './audio-data'

/**
 * Where a montage stops being comfortable. Six decibels of headroom is what a mixing desk marks
 * and what a normalised take is expected to leave: past it there is still room, but not enough
 * for a transient nobody predicted.
 */
export const HOT_DB = -6

/** Full scale. Past it the output wraps the samples, which is heard as a crackle. */
export const CLIP_DB = 0

/**
 * The same two thresholds as amplitudes, which is what every surface reading a level actually
 * compares against — a sample, a peak, a spectrum bin. Derived here rather than written twice:
 * the decibel above is the number a mix is discussed in, the amplitude is the number it is drawn
 * in, and they must not be able to disagree.
 */
export const HOT_AMPLITUDE = fromDb(HOT_DB)
export const CLIP_AMPLITUDE = fromDb(CLIP_DB)

/** The graduations a level is read against. Below the last one, a montage is simply quiet. */
export const SCALE_DB = [HOT_DB, -12, -18]

/**
 * How far down a meter reads before it simply says "nothing".
 *
 * A meter is graduated in decibels, never in amplitude: half the amplitude is only six decibels,
 * so a linear bar spends nine tenths of its height on the top six of a forty-eight decibel range
 * and shows a quiet passage as no bar at all.
 */
export const FLOOR_DB = -48

/** Where an amplitude stands on that scale, from nothing at the floor to full at the ceiling. */
export function meterFraction(amplitude: number): number {
  const reach = Math.abs(amplitude)
  if (reach <= 0) return 0
  return clamp((toDb(reach) - FLOOR_DB) / (CLIP_DB - FLOOR_DB), 0, 1)
}

/** What a level is worth to a reader, and the three colours a meter paints it in. */
type Level = 'safe' | 'hot' | 'clip'

/**
 * The band a point already ON that scale falls in, for the readers handed a fraction rather than
 * an amplitude — an analyser bin is one, being a byte spread between the floor and the ceiling.
 *
 * Converted back and passed to `levelOf` rather than compared against fractions of its own: the
 * two thresholds are written once, and a spectrum bar cannot come to mean something a meter bar
 * does not. Reading a fraction as if it were an amplitude is how the bass bars came out amber
 * while sitting fifty decibels under the ceiling.
 */
export function levelAtFraction(fraction: number): Level {
  return levelOf(fromDb(FLOOR_DB + fraction * (CLIP_DB - FLOOR_DB)))
}

/**
 * The band a reach falls in. A reach, not a sample: every caller hands over a distance from the
 * axis — a peak, a threshold, a bin — so a trough is already the crest it mirrors.
 */
function levelOf(reach: number): Level {
  if (reach >= CLIP_AMPLITUDE) return 'clip'
  return reach >= HOT_AMPLITUDE ? 'hot' : 'safe'
}

/**
 * How fast the bar falls back once the sound has, in decibels a second.
 *
 * A meter that fell as fast as the signal would be unreadable: speech and music are mostly
 * silence between transients, and the bar would flicker rather than show a level. It RISES
 * instantly, though — what a meter exists for is catching the peak that was about to be missed.
 */
const FALL_DB_PER_SECOND = 20

/** How long the peak witness stands at its mark before it starts falling too, in seconds. */
const PEAK_HOLD = 1.5

/**
 * What a meter shows, and what it has to remember between two frames to show it: the bar, the
 * witness standing above it, and the instant each was last moved.
 *
 * The two instants are two clocks and not one — the bar falls from the frame before, the witness
 * from the peak it is still holding, and reading either against the other empties the wrong one.
 */
export type MeterState = {
  level: number
  peak: number
  at: number
  peakAt: number
  /** Latched: an overload seen for one frame has to survive to be seen by an eye at all. */
  clipped: boolean
}

export const RESTING_METER: MeterState = { level: 0, peak: 0, at: 0, peakAt: 0, clipped: false }

/**
 * The meter once the sound has stopped: the bar and its witness fall, the overload stays.
 *
 * The two halves answer different questions. A bar frozen at the level a stopped montage last
 * reached reads as a montage still going out, which is the one thing a meter must never say; the
 * lamp is a fact about the pass just heard, and outliving it is what it is for.
 */
export function restedFrom(meter: MeterState): MeterState {
  return { ...RESTING_METER, clipped: meter.clipped }
}

/** The loudest sample of a window: what warns of an overload is the peak, never the average. */
export function peakOf(samples: Float32Array): number {
  let loudest = 0
  for (const sample of samples) {
    const reach = Math.abs(sample)
    if (reach > loudest) loudest = reach
  }
  return loudest
}

/**
 * The meter one frame later: instant on the way up, gradual on the way down, and latching what
 * it saw touch the ceiling.
 *
 * `now` is passed in rather than read: a meter is arithmetic, and arithmetic that reads a clock
 * cannot be tested at a chosen instant.
 */
export function meterFrom(reach: number, previous: MeterState, now: number): MeterState {
  const fallen = previous.level * fromDb(-FALL_DB_PER_SECOND * Math.max(0, now - previous.at))
  const level = Math.max(reach, fallen)
  // Beaten, or simply held long enough: either way the witness leaves the mark it was standing on.
  const moves = level >= previous.peak || now - previous.peakAt >= PEAK_HOLD

  return {
    level,
    peak: moves ? level : previous.peak,
    at: now,
    peakAt: moves ? now : previous.peakAt,
    clipped: previous.clipped || levelOf(reach) === 'clip',
  }
}

import { fromDb } from './audio-data'

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

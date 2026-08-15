import type { Size } from '@/engines/core/geometry'
import { memoPalette, rootColour } from '@/engines/core/palette'
import { HOT_AMPLITUDE, meterFraction, type MeterState } from './level'

/** What a meter needs of a palette, and nothing more. */
export type MeterPalette = {
  rail: string
  safe: string
  hot: string
  peak: string
  clip: string
}

/**
 * The meter's own inks, read once per theme rather than once per frame — this one repaints sixty
 * times a second while a montage plays, which is the whole reason `memoPalette` exists.
 */
export const readMeterPalette = memoPalette((): MeterPalette => ({
  rail: rootColour('--color-surface'),
  safe: rootColour('--color-level-safe'),
  hot: rootColour('--color-warning'),
  peak: rootColour('--color-text'),
  clip: rootColour('--color-danger'),
}))

/** How tall the overload lamp is, how far the scale keeps off it, and the witness line's own. */
const LAMP_HEIGHT = 4
const LAMP_GAP = 1
const PEAK_HEIGHT = 2

/**
 * A level, standing up.
 *
 * Two bands and two witnesses, which is what a mixing desk shows and for the reasons it shows
 * them: the bar says where the sound is now, the line above says where it last peaked — a mark
 * standing still long enough to be read — and the lamp at the top says an overload happened at
 * all, since one frame at full scale falls between two glances.
 *
 * There is no red BAND: full scale is the top of the scale, so a red segment would be a band of
 * zero height. What goes red is the lamp.
 */
export function paintMeter(
  context: CanvasRenderingContext2D,
  size: Size,
  meter: MeterState,
  palette: MeterPalette,
): void {
  context.fillStyle = palette.rail
  context.fillRect(0, 0, size.width, size.height)

  const scale = size.height - LAMP_HEIGHT - LAMP_GAP
  const level = meterFraction(meter.level)
  const hot = meterFraction(HOT_AMPLITUDE)

  paintBand(context, size.width, scale, 0, Math.min(level, hot), palette.safe)
  paintBand(context, size.width, scale, hot, level, palette.hot)

  const peak = meterFraction(meter.peak)
  if (peak > 0) {
    context.fillStyle = palette.peak
    context.fillRect(0, Math.round(scale * (1 - peak)), size.width, PEAK_HEIGHT)
  }

  if (meter.clipped) {
    context.fillStyle = palette.clip
    context.fillRect(0, 0, size.width, LAMP_HEIGHT)
  }
}

/** One segment of the bar, between two fractions of the scale, counted from the bottom. */
function paintBand(
  context: CanvasRenderingContext2D,
  width: number,
  scale: number,
  from: number,
  to: number,
  colour: string,
): void {
  if (to <= from) return

  const top = scale * (1 - to)
  const bottom = scale * (1 - from)
  context.fillStyle = colour
  context.fillRect(0, top, width, bottom - top)
}

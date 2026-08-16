import { fromDb } from '@/engines/audio/audio-data'
import { CLIP_AMPLITUDE, HOT_AMPLITUDE, SCALE_DB } from '@/engines/audio/level'
import type { Size } from '@/engines/core/geometry'
import { memoPalette, rootColour } from '@/engines/core/palette'
import { paintWaveform, waveAxis } from './painter'
import { paintRuler, readRulerStyle, type RulerStyle } from './ruler'
import { clampScale } from './viewport'
import { RULER_HEIGHT, timeToX, type Viewport } from './timeline-geometry'
import {
  playsThrough,
  sequenceDuration,
  type Clip,
  type SequenceState,
  type Us,
} from './timeline-state'
import { waveformColumns, type WaveColumn } from './waveform'

/**
 * The waveform of a whole montage: every audible clip laid over the same pixel columns and added
 * up, which is what the output actually hands the speakers.
 *
 * Built from the SAME peaks the strip draws its clips from, so the monitor and the strip can
 * never disagree about what is there — and so that showing the programme costs no decode of its
 * own. A clip whose waveform has not arrived contributes nothing rather than blocking the rest.
 *
 * Muted and soloed-out tracks are left out, on the montage's own rule: what is shown follows what
 * is heard. The clip's gain is applied because it is a level the output really applies; its fades
 * are not, being an envelope rather than a level — the strip draws those as bevels of its own.
 */
export function programColumns(
  state: SequenceState,
  peaksOf: (clip: Clip) => Float32Array | null,
  viewport: Viewport,
  from: number,
  to: number,
): WaveColumn[] {
  const summed = new Map<number, { min: number; max: number }>()

  for (const track of state.tracks) {
    if (track.kind !== 'audio' || !playsThrough(state, track)) continue

    for (const clip of track.clips) {
      const peaks = peaksOf(clip)
      if (!peaks) continue

      const level = fromDb(clip.gain)
      for (const column of waveformColumns(clip, peaks, viewport, from, to)) {
        const held = summed.get(column.x)
        const min = column.min * level
        const max = column.max * level
        if (held) {
          held.min += min
          held.max += max
        } else {
          summed.set(column.x, { min, max })
        }
      }
    }
  }

  // Sorted, because a painter walks columns left to right and the map holds them in the order
  // the tracks happened to be read in.
  return [...summed.entries()]
    .map(([x, extremes]) => ({ x, ...extremes }))
    .sort((left, right) => left.x - right.x)
}

export type ProgramPalette = {
  /** The three bands a level is read in, by height rather than by column. */
  safe: string
  hot: string
  clip: string
  /**
   * The line traced through the body of the wave, or ABSENT when the reader has taken the curve
   * away — it is the one mark here that answers a question not everyone is asking.
   *
   * The chassis colour when it is drawn, so it reads as a groove cut into whichever band it
   * crosses: `design/tokens.test.ts` holds all three of those apart from it.
   */
  envelope?: string
  playhead: string
  background: string
  ruler: RulerStyle
  /**
   * The graduations behind the wave — a colour and nothing else. They carried their decibels in
   * writing until 2026-08-16, and three labels on a linear axis stacked on top of one another
   * around the middle, where −12 and −18 are a few pixels apart.
   */
  scale: string
}

/**
 * The monitor's own inks, read once per theme rather than once per paint — this repaints on every
 * frame of playback, the playhead being written to the store from the output clock.
 *
 * `envelope` is not here: it is the one entry the host decides rather than the theme, being absent
 * when the reader has put the curves away. It carries the chassis colour when it is drawn.
 */
export const readProgramPalette = memoPalette((): Omit<ProgramPalette, 'envelope'> => ({
  background: rootColour('--color-chassis'),
  // Three bands rather than one grey, and each is a token the palette already holds: the amber
  // and the red are the studio's own "watch this" and "this went wrong", which is exactly what
  // −6 dB and full scale mean on a montage.
  safe: rootColour('--color-level-safe'),
  hot: rootColour('--color-warning'),
  clip: rootColour('--color-danger'),
  playhead: rootColour('--color-accent'),
  // The strip's own ruler, not one of this monitor's making: the pair reads as one grid.
  ruler: readRulerStyle(),
  scale: rootColour('--color-border'),
}))

/**
 * How many columns the envelope averages over. A visual smoothing rather than a time constant:
 * the monitor fits a whole montage to its width, so a span in columns keeps the same reading
 * whether the montage runs a minute or an hour.
 */
const ENVELOPE_SPAN = 9

/**
 * The average reach of the wave around each column — the body of the sound, under the crests.
 *
 * NOT an RMS, and the difference matters to anyone reading it: what a montage keeps on disk is
 * pairs of extremes, one per fraction of a second, and the samples an RMS needs are long gone by
 * the time a monitor draws. This is the mean of those extremes, which follows loudness closely
 * enough to show where a montage sits, and is honest about being a smoothing of peaks.
 */
export function programEnvelope(columns: readonly WaveColumn[]): WaveColumn[] {
  const half = Math.floor(ENVELOPE_SPAN / 2)
  const reachAt = (index: number): number => {
    const column = columns[index]
    return column ? (Math.abs(column.min) + Math.abs(column.max)) / 2 : 0
  }

  // A running sum rather than a window walked per column: this is painted on every frame of
  // playback, and nine reads a column over a thousand of them is nine thousand a frame for an
  // answer that only ever gains one end and loses the other.
  let total = 0
  let counted = 0
  for (let at = 0; at <= half && at < columns.length; at++) {
    total += reachAt(at)
    counted++
  }

  return columns.map((column, index) => {
    const reach = counted === 0 ? 0 : total / counted

    const leaving = index - half
    const arriving = index + half + 1
    if (leaving >= 0) {
      total -= reachAt(leaving)
      counted--
    }
    if (arriving < columns.length) {
      total += reachAt(arriving)
      counted++
    }

    return { x: column.x, min: -reach, max: reach }
  })
}

/**
 * The programme monitor: a montage over a span of time, its graduations, and where the head stands.
 *
 * The whole montage fitting the width is the view it OPENS on — `programViewport` builds that one
 * — but no longer the only one it can show: ten minutes of music squeezed into a panel is a green
 * band with no shape in it, and nothing to read. The viewport comes in from the host, which owns
 * the wheel and the fit button. An empty montage draws its background and nothing else.
 *
 * The ruler is `paintRuler`, the very one the strip below wears, and that is the point: the same
 * graduations and the same timecode in both places, or the eye has two grids to reconcile. The
 * wave keeps the rest of the height, so the head crosses both without a break.
 */
export function paintProgram(
  context: CanvasRenderingContext2D,
  state: SequenceState,
  peaksOf: (clip: Clip) => Float32Array | null,
  size: Size,
  palette: ProgramPalette,
  viewport: Viewport,
): void {
  context.fillStyle = palette.background
  context.fillRect(0, 0, size.width, size.height)

  const top = RULER_HEIGHT
  const height = size.height - RULER_HEIGHT
  const columns = programColumns(state, peaksOf, viewport, 0, size.width)

  paintScale(context, size.width, top, height, palette.scale)
  paintBandedWave(context, columns, size.width, top, height, palette)
  if (palette.envelope) {
    paintEnvelope(context, programEnvelope(columns), top, height, palette.envelope)
  }

  paintRuler(context, {
    viewport,
    width: size.width,
    fps: state.settings.fps,
    style: palette.ruler,
  })

  context.fillStyle = palette.playhead
  context.fillRect(Math.round(timeToX(state.playhead, viewport)), 0, 1, size.height)
}

/** The loudest reach of a run of columns, which is what decides whether a band is worth a pass. */
function loudestOf(columns: readonly WaveColumn[]): number {
  let loudest = 0
  for (const column of columns) {
    loudest = Math.max(loudest, Math.abs(column.min), Math.abs(column.max))
  }
  return loudest
}

/**
 * The wave in three bands, cut by HEIGHT rather than by column: the part of a crest that stands
 * above −6 dB is amber, the part touching full scale is red, and everything under stays calm.
 *
 * By height because that is what the eye is asked to judge — how far a peak reaches, not which
 * pixel it happened on. Colouring whole columns instead would paint a quiet stretch red for one
 * transient crossing it, and a single-column run draws a path of zero width, which is nothing.
 *
 * A band nothing reaches is not painted at all. Each pass walks every column twice and clips the
 * whole canvas, and this runs on every frame of playback: a quiet montage would have paid for two
 * of them to draw nothing.
 */
function paintBandedWave(
  context: CanvasRenderingContext2D,
  columns: readonly WaveColumn[],
  width: number,
  top: number,
  height: number,
  palette: ProgramPalette,
): void {
  paintWaveform(context, columns, top, height, palette.safe)

  const loudest = loudestOf(columns)
  if (loudest < HOT_AMPLITUDE) return

  paintAbove(context, columns, width, top, height, HOT_AMPLITUDE, palette.hot)
  if (loudest >= CLIP_AMPLITUDE) {
    paintAbove(context, columns, width, top, height, CLIP_AMPLITUDE, palette.clip)
  }
}

/** The same wave again, showing only what reaches past a threshold on either side of the axis. */
function paintAbove(
  context: CanvasRenderingContext2D,
  columns: readonly WaveColumn[],
  width: number,
  top: number,
  height: number,
  threshold: number,
  colour: string,
): void {
  const { middle, reach } = waveAxis(top, height)
  const offset = threshold * reach
  const crest = middle - offset
  const trough = middle + offset

  context.save()
  context.beginPath()
  // Two rectangles in one region: the band above the axis and its mirror below, which a wave
  // reaches at the same instant.
  context.rect(0, top, width, crest - top)
  context.rect(0, trough, width, top + height - trough)
  context.clip()
  paintWaveform(context, columns, top, height, colour)
  context.restore()
}

/**
 * The average reach, as a pair of lines rather than a second filled shape.
 *
 * Drawn in the chassis colour: a groove of the background cut through the wave reads on all three
 * bands at once, where any ink of its own would have to clear green, amber and red together —
 * and the only token measured against those three is the surface they are painted on.
 */
function paintEnvelope(
  context: CanvasRenderingContext2D,
  envelope: readonly WaveColumn[],
  top: number,
  height: number,
  colour: string,
): void {
  if (envelope.length === 0) return

  const { middle, reach } = waveAxis(top, height)

  context.strokeStyle = colour
  context.lineWidth = 1
  for (const side of [1, -1]) {
    context.beginPath()
    for (const column of envelope) context.lineTo(column.x, middle - column.max * reach * side)
    context.stroke()
  }
}

/** The graduations, behind the wave: a grid is read through what stands on it, never over it. */
function paintScale(
  context: CanvasRenderingContext2D,
  width: number,
  top: number,
  height: number,
  colour: string,
): void {
  const { middle, reach } = waveAxis(top, height)

  context.fillStyle = colour
  for (const db of SCALE_DB) {
    const offset = fromDb(db) * reach
    // Half a pixel, so a one-pixel line lands on a pixel instead of across two.
    context.fillRect(0, Math.round(middle - offset) + 0.5, width, 1)
    context.fillRect(0, Math.round(middle + offset) + 0.5, width, 1)
  }
}

/**
 * The viewport that fits a montage to a width, and the one the head is placed against.
 *
 * Clamped to the scale the wheel is clamped to: a montage of a few tenths of a second across a
 * wide panel fits at a scale past `MAX_SCALE`, and the first zoom IN would then have zoomed out —
 * `zoomAt` cannot go past the ceiling, so it would have landed under where the fit already was.
 */
export function programViewport(state: SequenceState, width: number): Viewport {
  const span: Us = Math.max(1, sequenceDuration(state))
  return { scale: clampScale(width / span), offset: 0, scrollTop: 0 }
}

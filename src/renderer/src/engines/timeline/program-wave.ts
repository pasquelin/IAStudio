import { fromDb } from '@/engines/audio/audio-data'
import { CLIP_AMPLITUDE, HOT_AMPLITUDE, SCALE_DB } from '@/engines/audio/level'
import type { Size } from '@/engines/core/geometry'
import { NO_BREAK_SPACE } from '@shared/i18n/typography'
import { formatDecimal } from '@/helpers/format'
import { paintWaveform } from './painter'
import { paintRuler, type RulerStyle } from './ruler'
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

/**
 * The graduated scale drawn behind the wave, and the words on it.
 *
 * `unit` arrives already translated and `language` decides how the number reads, exactly as
 * `formatBytes` takes its unit from its caller: a painter reads tokens, never a bundle.
 */
export type ScaleStyle = {
  line: string
  text: string
  /** What a label is written on, so the ink keeps the surface it was measured against. */
  background: string
  font: string
  unit: string
  language: string
}

export type ProgramPalette = {
  /** The three bands a level is read in, by height rather than by column. */
  safe: string
  hot: string
  clip: string
  /**
   * The line traced through the body of the wave. The chassis colour, so it reads as a groove cut
   * into whichever band it crosses — `design/tokens.test.ts` holds all three apart from it.
   */
  envelope: string
  playhead: string
  background: string
  ruler: RulerStyle
  scale: ScaleStyle
}

/**
 * How many columns the envelope averages over. A visual smoothing rather than a time constant:
 * the monitor fits a whole montage to its width, so a span in columns keeps the same reading
 * whether the montage runs a minute or an hour.
 */
const ENVELOPE_SPAN = 9

/** How far a scale label sits from the edge and from its own line. */
const LABEL_INSET = 3
const LABEL_LIFT = 2

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

  return columns.map((column, index) => {
    let total = 0
    let counted = 0
    for (let at = index - half; at <= index + half; at++) {
      const neighbour = columns[at]
      if (!neighbour) continue
      total += (Math.abs(neighbour.min) + Math.abs(neighbour.max)) / 2
      counted++
    }

    const reach = counted === 0 ? 0 : total / counted
    return { x: column.x, min: -reach, max: reach }
  })
}

/**
 * The programme monitor: the montage from end to end, its graduations, and where the head stands.
 *
 * The whole montage always fits the width — this is not a strip one scrolls, it is the "what am
 * I making" view, and a monitor that had to be scrolled to be read would answer a question
 * nobody asked it. An empty montage draws its background and nothing else.
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
): void {
  context.fillStyle = palette.background
  context.fillRect(0, 0, size.width, size.height)

  const viewport = programViewport(state, size.width)
  const top = RULER_HEIGHT
  const height = size.height - RULER_HEIGHT
  const columns = programColumns(state, peaksOf, viewport, 0, size.width)

  paintScale(context, size, top, height, palette.scale)
  paintBandedWave(context, columns, size.width, top, height, palette)
  paintEnvelope(context, programEnvelope(columns), top, height, palette.envelope)
  paintScaleLabels(context, top, height, palette.scale)

  paintRuler(context, {
    viewport,
    width: size.width,
    fps: state.settings.fps,
    style: palette.ruler,
  })

  context.fillStyle = palette.playhead
  context.fillRect(Math.round(timeToX(state.playhead, viewport)), 0, 1, size.height)
}

/** Where an amplitude stands on the wave's half-height, measured from the middle out. */
function reachOf(height: number): number {
  return height / 2 - 1
}

/**
 * The wave in three bands, cut by HEIGHT rather than by column: the part of a crest that stands
 * above −6 dB is amber, the part touching full scale is red, and everything under stays calm.
 *
 * By height because that is what the eye is asked to judge — how far a peak reaches, not which
 * pixel it happened on. Colouring whole columns instead would paint a quiet stretch red for one
 * transient crossing it, and a single-column run draws a path of zero width, which is nothing.
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
  paintAbove(context, columns, width, top, height, HOT_AMPLITUDE, palette.hot)
  paintAbove(context, columns, width, top, height, CLIP_AMPLITUDE, palette.clip)
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
  const middle = top + height / 2
  const offset = threshold * reachOf(height)
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

  const middle = top + height / 2
  const reach = reachOf(height)

  context.strokeStyle = colour
  context.lineWidth = 1
  for (const side of [1, -1]) {
    context.beginPath()
    for (const column of envelope) context.lineTo(column.x, middle - column.max * reach * side)
    context.stroke()
  }
}

/** Where a graduation sits on the wave, as a distance either side of the axis. */
function scaleOffsets(height: number): { db: number; offset: number }[] {
  return SCALE_DB.map(db => ({ db, offset: fromDb(db) * reachOf(height) }))
}

/** The graduations, behind the wave: a grid is read through what stands on it, never over it. */
function paintScale(
  context: CanvasRenderingContext2D,
  size: Size,
  top: number,
  height: number,
  style: ScaleStyle,
): void {
  const middle = top + height / 2

  context.fillStyle = style.line
  for (const { offset } of scaleOffsets(height)) {
    // Half a pixel, so a one-pixel line lands on a pixel instead of across two.
    context.fillRect(0, Math.round(middle - offset) + 0.5, size.width, 1)
    context.fillRect(0, Math.round(middle + offset) + 0.5, size.width, 1)
  }
}

/**
 * What each graduation is worth, written once above its upper line.
 *
 * On a plate of the background, and that is not decoration: `muted` on the calm green carries
 * 1.1:1, so a label laid straight over a loud passage would vanish exactly where the scale is
 * worth reading. The plate gives every label the one surface the ink was measured against.
 */
function paintScaleLabels(
  context: CanvasRenderingContext2D,
  top: number,
  height: number,
  style: ScaleStyle,
): void {
  const middle = top + height / 2

  context.font = style.font
  context.textBaseline = 'bottom'

  for (const { db, offset } of scaleOffsets(height)) {
    const label = `${formatDecimal(db, style.language, { digits: 0 })}${NO_BREAK_SPACE}${style.unit}`
    const baseline = Math.round(middle - offset) - LABEL_LIFT
    const measured = context.measureText(label)
    if (baseline - measured.actualBoundingBoxAscent < top) continue

    context.fillStyle = style.background
    context.fillRect(
      0,
      baseline - measured.actualBoundingBoxAscent - LABEL_LIFT,
      measured.width + LABEL_INSET * 2,
      measured.actualBoundingBoxAscent + LABEL_LIFT * 2,
    )
    context.fillStyle = style.text
    context.fillText(label, LABEL_INSET, baseline)
  }
}

/** The viewport that fits a montage to a width, and the one the head is placed against. */
export function programViewport(state: SequenceState, width: number): Viewport {
  const span: Us = Math.max(1, sequenceDuration(state))
  return { scale: width / span, offset: 0, scrollTop: 0 }
}

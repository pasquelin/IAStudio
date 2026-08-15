import { fromDb } from '@/engines/audio/audio-data'
import type { Size } from '@/engines/core/geometry'
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

export type ProgramPalette = {
  wave: string
  playhead: string
  background: string
  ruler: RulerStyle
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
  paintWaveform(
    context,
    programColumns(state, peaksOf, viewport, 0, size.width),
    RULER_HEIGHT,
    size.height - RULER_HEIGHT,
    palette.wave,
  )

  paintRuler(context, {
    viewport,
    width: size.width,
    fps: state.settings.fps,
    style: palette.ruler,
  })

  context.fillStyle = palette.playhead
  context.fillRect(Math.round(timeToX(state.playhead, viewport)), 0, 1, size.height)
}

/** The viewport that fits a montage to a width, and the one the head is placed against. */
export function programViewport(state: SequenceState, width: number): Viewport {
  const span: Us = Math.max(1, sequenceDuration(state))
  return { scale: width / span, offset: 0, scrollTop: 0 }
}

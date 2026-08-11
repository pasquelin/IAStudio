/**
 * The graduated strip above a band, painted the same way for a montage and for a scene.
 *
 * It takes a style rather than reading tokens itself: each band caches its own palette, and a
 * second `getComputedStyle` per paint is the frame budget — see `painter.ts`.
 */
import { frameDuration, SECOND, type Us } from '@shared/domain/time'
import { RULER_HEIGHT, timeToX, visibleRange, type Viewport } from './timeline-geometry'
import { formatTimecode } from './timecode'

/** What a ruler needs of a palette, and nothing more. */
export type RulerStyle = {
  background: string
  tick: string
  text: string
  font: string
}

/** How tall a graduation is, and how far its label sits from it. */
const TICK_HEIGHT = 6
const LABEL_GAP = 4

/** Graduations never crowd below this, in pixels. */
const MIN_SPACING = 60

/** How many frames a graduation may span before seconds take over. */
const FRAME_STEPS: readonly number[] = [1, 2, 5, 10, 25]

/** And how many seconds, once one frame is too fine to read. */
const SECOND_STEPS: readonly number[] = [1, 2, 5, 10, 30, 60, 120, 300, 600, 900]

/** The step a run of graduations falls back to when even fifteen minutes crowd: half an hour. */
const LAST_STEP = 1_800

/**
 * Microseconds between two graduations, chosen so they never crowd below ~60 px apart. Below a
 * second the grid becomes the frame grid: zoomed in that far, seconds are what stops being
 * useful, and a graduation off the frame boundary cannot be trusted to cut against.
 */
export function tickStep(scale: number, fps: number): Us {
  const frame = frameDuration(fps)
  const fits = (step: Us): boolean => step * scale >= MIN_SPACING

  for (const frames of FRAME_STEPS) {
    const step = frame * frames
    if (step < SECOND && fits(step)) return step
  }

  return (SECOND_STEPS.find(step => fits(step * SECOND)) ?? LAST_STEP) * SECOND
}

export type RulerPaint = {
  viewport: Viewport
  width: number
  fps: number
  style: RulerStyle
}

export function paintRuler(context: CanvasRenderingContext2D, paint: RulerPaint): void {
  const { viewport, width, fps, style } = paint

  context.fillStyle = style.background
  context.fillRect(0, 0, width, RULER_HEIGHT)

  const step = tickStep(viewport.scale, fps)
  const [from, to] = visibleRange(viewport, width)
  context.font = style.font
  context.textBaseline = 'middle'

  for (let time = Math.floor(from / step) * step; time <= to; time += step) {
    // The half pixel is what keeps a one-pixel rule from being drawn across two.
    const x = Math.round(timeToX(time, viewport)) + 0.5
    context.fillStyle = style.tick
    context.fillRect(x, RULER_HEIGHT - TICK_HEIGHT, 1, TICK_HEIGHT)

    context.fillStyle = style.text
    context.fillText(formatTimecode(time, fps), x + LABEL_GAP, RULER_HEIGHT / 2)
  }

  context.fillStyle = style.tick
  context.fillRect(0, RULER_HEIGHT - 1, width, 1)
}

/**
 * Where a band stops, marked the same way on every timeline of the studio.
 *
 * It replaces the dimming a scene's sheet used to paint over everything past its duration: a
 * `--color-scrim` wash read as a black hole beside a montage that marked nothing at all, and the
 * three bands then looked like three different tools. A rule is enough to say "nothing beyond
 * here", and it says it identically whether the end is a declared duration — a scene — or the
 * end of the last clip — a montage.
 */
import type { Us } from '@shared/domain/time'
import { timeToX, type Viewport } from './timeline-geometry'

/** Width of the rule, in pixels. Two, so it is not read as one more graduation. */
const END_WIDTH = 2

export type BandEndPaint = {
  end: Us
  viewport: Viewport
  width: number
  height: number
  colour: string
}

export function paintBandEnd(context: CanvasRenderingContext2D, paint: BandEndPaint): void {
  // A band with nothing in it ends where it starts, and a rule against the left edge would read
  // as a border rather than as an end.
  if (paint.end <= 0) return

  const x = Math.round(timeToX(paint.end, paint.viewport))
  if (x < 0 || x > paint.width) return

  context.fillStyle = paint.colour
  context.fillRect(x, 0, END_WIDTH, paint.height)
}

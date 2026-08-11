/**
 * What a point on the animation band is pointing at.
 *
 * Kept apart from the paint so it can be held to account without a canvas: the two agree because
 * both derive a row's position from `placeRows` and a key's from `timeToX`, never from their own
 * arithmetic.
 */
import { snapToFrame, type Us } from '@shared/domain/time'
import { placeRows } from '../timeline/band'
import { RULER_HEIGHT, timeToX, xToTime, type Viewport } from '../timeline/timeline-geometry'
import { keysOf, reachOf } from './animation-painter'
import type { AnimationRow } from './animation-rows'

export type Point = { x: number; y: number }

export type AnimationHit =
  /** The graduated strip: pressing there scrubs, wherever the pointer then goes. */
  | { kind: 'ruler'; time: Us }
  | { kind: 'key'; rowId: string; time: Us }
  | { kind: 'row'; rowId: string; time: Us }

export type HitContext = {
  rows: readonly AnimationRow[]
  viewport: Viewport
  fps: number
}

/**
 * A key is grabbed within half a diamond of its centre, PLUS a pixel of slack: a diamond is a
 * few pixels across, and asking a hand to land inside one is asking too much.
 */
const GRAB_SLACK = 2

export function hitAnimation(context: HitContext, point: Point): AnimationHit | null {
  const { rows, viewport, fps } = context
  const at = snapToFrame(xToTime(point.x, viewport), fps)

  if (point.y < RULER_HEIGHT) return { kind: 'ruler', time: at }

  const from = point.y + viewport.scrollTop - RULER_HEIGHT
  if (from < 0) return null

  for (const { item: row, offset } of placeRows(rows)) {
    if (from >= offset + row.height) continue

    const grab = reachOf(row) + GRAB_SLACK
    for (const time of keysOf(row)) {
      if (Math.abs(timeToX(time, viewport) - point.x) <= grab) {
        return { kind: 'key', rowId: row.id, time }
      }
    }
    return { kind: 'row', rowId: row.id, time: at }
  }

  return null
}

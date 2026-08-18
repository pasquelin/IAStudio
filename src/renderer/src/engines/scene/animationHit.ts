/**
 * What a point on the animation band is pointing at.
 *
 * Kept apart from the paint so it can be held to account without a canvas: the two agree because
 * both derive a row's position from `placeRows` and a key's from `timeToX`, never from their own
 * arithmetic.
 */
import { snapToFrame, type Us } from '@shared/domain/time'
import { placeRows } from '../timeline/band'
import {
  edgeGrab,
  RULER_HEIGHT,
  timeToX,
  xToTime,
  type Viewport,
} from '../timeline/timelineGeometry'
import { keysOf, reachOf } from './animationPainter'
import type { Point } from '../core/geometry'
import type { AnimationRow } from './animationRows'

export type AnimationHit =
  /** The graduated strip: pressing there scrubs, wherever the pointer then goes. */
  | { kind: 'ruler'; time: Us }
  | { kind: 'key'; rowId: string; time: Us }
  /** A clip block, and how far into it the pointer landed — a drag must not snap it to the hand. */
  | { kind: 'block'; rowId: string; nodeId: string; clipId: string; grabbedAt: Us }
  /** A shot: its body slides, its two edges trim. `grabbedAt` is how far into it the hand landed. */
  | { kind: 'shot'; rowId: string; shotId: string; edge: 'start' | 'end' | null; grabbedAt: Us }
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

/**
 * Which edge of a bar the hand landed on, through the montage's own `edgeGrab`: handles are
 * measured in PIXELS, and they shrink on a narrow bar so its body stays draggable.
 */
function edgeOf(start: Us, duration: Us, x: number, viewport: Viewport): 'start' | 'end' | null {
  const left = timeToX(start, viewport)
  const right = timeToX(start + duration, viewport)
  const grab = edgeGrab(right - left)

  if (Math.abs(left - x) <= grab) return 'start'
  return Math.abs(right - x) <= grab ? 'end' : null
}

export function hitAnimation(context: HitContext, point: Point): AnimationHit | null {
  const { rows, viewport, fps } = context
  const at = snapToFrame(xToTime(point.x, viewport), fps)

  if (point.y < RULER_HEIGHT) return { kind: 'ruler', time: at }

  const from = point.y + viewport.scrollTop - RULER_HEIGHT
  if (from < 0) return null

  for (const { item: row, offset } of placeRows(rows)) {
    if (from >= offset + row.height) continue

    if (row.kind === 'clip') {
      const at = xToTime(point.x, viewport)
      if (at < row.start || at > row.start + row.duration)
        return { kind: 'row', rowId: row.id, time: at }
      return {
        kind: 'block',
        rowId: row.id,
        nodeId: row.nodeId,
        clipId: row.clipId,
        grabbedAt: at - row.start,
      }
    }

    const grab = reachOf(row) + GRAB_SLACK
    for (const time of keysOf(row)) {
      if (Math.abs(timeToX(time, viewport) - point.x) <= grab) {
        return { kind: 'key', rowId: row.id, time }
      }
    }

    // The bars come after the diamonds because they are painted UNDER them: on a camera's line a
    // key is what the pointer meets first, and the shot it stands on is what is left.
    if (row.kind === 'subject' && row.bars) {
      const on = xToTime(point.x, viewport)
      const bar = row.bars.find(
        held => on >= held.shot.start && on <= held.shot.start + held.shot.duration,
      )
      if (bar) {
        return {
          kind: 'shot',
          rowId: row.id,
          shotId: bar.shot.id,
          edge: edgeOf(bar.shot.start, bar.shot.duration, point.x, viewport),
          grabbedAt: on - bar.shot.start,
        }
      }
    }

    return { kind: 'row', rowId: row.id, time: at }
  }

  return null
}

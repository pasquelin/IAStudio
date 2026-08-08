import type { Rect, Transform } from './canvas-state'
import type { Point } from './shape-geometry'

/**
 * The nine grips of a transform box: eight on the edge, one above it for rotation. Pixi ships no
 * transformer, so the geometry is ours — and being plain arithmetic it belongs here, where it can
 * be tested without a GPU.
 */
export type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'rotate'

export const HANDLE_IDS: readonly HandleId[] = [
  'nw',
  'n',
  'ne',
  'e',
  'se',
  's',
  'sw',
  'w',
  'rotate',
]

/** Which corner each grip pulls against: the opposite one stays put, as it does everywhere. */
const ANCHOR: Readonly<Record<Exclude<HandleId, 'rotate'>, { x: number; y: number }>> = {
  nw: { x: 1, y: 1 },
  n: { x: 0.5, y: 1 },
  ne: { x: 0, y: 1 },
  e: { x: 0, y: 0.5 },
  se: { x: 0, y: 0 },
  s: { x: 0.5, y: 0 },
  sw: { x: 1, y: 0 },
  w: { x: 1, y: 0.5 },
}

/** How far above the box the rotation grip floats, in document units at 1:1. */
export const ROTATE_OFFSET = 24

/** Half the side of a grip's hit square, in screen pixels — grips do not scale with the zoom. */
export const HANDLE_GRAB = 6

/** Where each grip sits, in document coordinates, for a layer occupying `box`. */
export function handlePoints(box: Rect): Readonly<Record<HandleId, Point>> {
  const right = box.x + box.width
  const bottom = box.y + box.height
  const middleX = box.x + box.width / 2
  const middleY = box.y + box.height / 2

  return {
    nw: { x: box.x, y: box.y },
    n: { x: middleX, y: box.y },
    ne: { x: right, y: box.y },
    e: { x: right, y: middleY },
    se: { x: right, y: bottom },
    s: { x: middleX, y: bottom },
    sw: { x: box.x, y: bottom },
    w: { x: box.x, y: middleY },
    rotate: { x: middleX, y: box.y - ROTATE_OFFSET },
  }
}

/** The grip under the point, tested in document units at the tolerance the caller scaled. */
export function handleAt(box: Rect, point: Point, tolerance: number): HandleId | null {
  const points = handlePoints(box)

  return (
    HANDLE_IDS.find(id => {
      const grip = points[id]
      return Math.abs(grip.x - point.x) <= tolerance && Math.abs(grip.y - point.y) <= tolerance
    }) ?? null
  )
}

/**
 * The transform a drag of one grip produces. The opposite corner stays put — pull the east grip
 * and the west edge does not move, which is the only behaviour that lets a layer be sized against
 * something else on the canvas.
 *
 * `uniform` is the shift key: the shorter side follows the longer, so a picture keeps its shape.
 */
export function resizeBy(
  transform: Transform,
  handle: HandleId,
  box: Rect,
  to: Point,
  uniform: boolean,
): Transform {
  if (handle === 'rotate') return transform

  const anchor = ANCHOR[handle]
  const fixed = { x: box.x + box.width * anchor.x, y: box.y + box.height * anchor.y }

  // A grip on an edge moves one axis only: the other keeps the scale it had.
  const pullsX = anchor.x !== 0.5
  const pullsY = anchor.y !== 0.5

  let scaleX = pullsX ? ratio(to.x - fixed.x, box.width * (anchor.x === 1 ? -1 : 1)) : 1
  let scaleY = pullsY ? ratio(to.y - fixed.y, box.height * (anchor.y === 1 ? -1 : 1)) : 1

  if (uniform && pullsX && pullsY) {
    const side = Math.max(Math.abs(scaleX), Math.abs(scaleY))
    scaleX = side * Math.sign(scaleX || 1)
    scaleY = side * Math.sign(scaleY || 1)
  }

  return {
    ...transform,
    scaleX: transform.scaleX * scaleX,
    scaleY: transform.scaleY * scaleY,
    // The fixed corner is fixed in document space, so the origin moves with the box.
    x: fixed.x - (fixed.x - transform.x) * scaleX,
    y: fixed.y - (fixed.y - transform.y) * scaleY,
  }
}

/** The angle from the box's middle to the pointer, which is what the rotation grip reads. */
export function rotateBy(transform: Transform, box: Rect, from: Point, to: Point): Transform {
  const middle = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  const before = Math.atan2(from.y - middle.y, from.x - middle.x)
  const after = Math.atan2(to.y - middle.y, to.x - middle.x)

  return { ...transform, rotation: transform.rotation + after - before }
}

/**
 * How far the grip travelled, as a share of the side it pulls. Never zero: a layer scaled to
 * nothing has no box left to grab, so the grips would be gone along with it and only ⌘Z could
 * bring it back.
 */
const MIN_RATIO = 0.01

function ratio(moved: number, extent: number): number {
  if (extent === 0) return 1
  const pulled = moved / extent
  return Math.abs(pulled) < MIN_RATIO ? MIN_RATIO * Math.sign(pulled || 1) : pulled
}

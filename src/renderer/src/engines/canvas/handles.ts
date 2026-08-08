import type { Rect, Transform } from './canvas-state'
import type { Point } from './shape-geometry'
import { crisp, toScreen, type Size, type Viewport } from './viewport'

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
export const ANCHOR: Readonly<Record<Exclude<HandleId, 'rotate'>, { x: number; y: number }>> = {
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

/**
 * Where a layer stands, in document units. Its texture is document-sized, so the box is the
 * document under the layer's own scale — grown about the origin it is pinned by, which is what
 * `place` does when it sets a pivot and compensates the position.
 */
export function layerBoxOf(transform: Transform, document: Size): Rect {
  const width = document.width * transform.scaleX
  const height = document.height * transform.scaleY

  return {
    x: transform.x + document.width * transform.originX * (1 - transform.scaleX),
    y: transform.y + document.height * transform.originY * (1 - transform.scaleY),
    width,
    height,
  }
}

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

/**
 * The squares each grip is drawn as, in screen pixels. Fixed-size on purpose: a grip that shrank
 * with the zoom would be unclickable on a document seen at 5%.
 *
 * Here rather than at each call site because two of them draw grips — the move tool's box and the
 * crop frame — and the grab size and the half-pixel offset have to agree between them.
 */
export function gripRects(box: Rect, viewport: Viewport): Readonly<Record<HandleId, Rect>> {
  const points = handlePoints(box)
  const square = (id: HandleId): Rect => {
    const screen = toScreen(viewport, points[id])
    return {
      x: crisp(screen.x - HANDLE_GRAB),
      y: crisp(screen.y - HANDLE_GRAB),
      width: HANDLE_GRAB * 2,
      height: HANDLE_GRAB * 2,
    }
  }

  return {
    nw: square('nw'),
    n: square('n'),
    ne: square('ne'),
    e: square('e'),
    se: square('se'),
    s: square('s'),
    sw: square('sw'),
    w: square('w'),
    rotate: square('rotate'),
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
  handle: Exclude<HandleId, 'rotate'>,
  document: Size,
  to: Point,
  uniform: boolean,
): Transform {
  const box = layerBoxOf(transform, document)
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

  const scaled = {
    ...transform,
    scaleX: floored(transform.scaleX * scaleX),
    scaleY: floored(transform.scaleY * scaleY),
  }

  // Solved through `layerBoxOf` rather than against `transform.x`: the two differ by the origin
  // term, and reading the transform directly let the anchored edge drift as the layer resized.
  const grown = layerBoxOf(scaled, document)
  return {
    ...scaled,
    x: scaled.x + (fixed.x - (grown.x + grown.width * anchor.x)),
    y: scaled.y + (fixed.y - (grown.y + grown.height * anchor.y)),
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
 * The smallest a layer may be scaled to. On the *result*, not on one gesture's step: the steps
 * multiply, so three collapsing drags of a bounded ratio still reached a millionth. A layer that
 * small has no box left to grab, and only ⌘Z would bring it back.
 */
const MIN_SCALE = 0.01

function ratio(moved: number, extent: number): number {
  // Near-zero, not exactly zero: a box that has already collapsed would divide by ~1e-17.
  if (Math.abs(extent) < Number.EPSILON) return 1
  return moved / extent
}

/** Keeps a scale off zero without flipping the mirror the user may have asked for. */
function floored(scale: number): number {
  return Math.abs(scale) < MIN_SCALE ? MIN_SCALE * Math.sign(scale || 1) : scale
}

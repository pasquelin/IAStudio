import type { Rect } from './canvasState'
import { box } from './shapeGeometry'
import type { Point } from '../core/geometry'

/**
 * The region a gesture carved out, in document coordinates.
 *
 * Session state, never part of `CanvasState`: a selection is how one is looking at a document,
 * not something one made of it, and ⌘Z must not give a marquee back.
 */
export type CanvasSelection =
  | { kind: 'rect'; rect: Rect }
  | { kind: 'ellipse'; rect: Rect }
  | { kind: 'lasso'; points: readonly Point[] }
  | null

/** Which shape each mode of the region group draws. */
export type SelectionShape = 'rect' | 'ellipse' | 'lasso'

/**
 * The selection a drag between two points makes. `square` is the shift key: a rectangle becomes
 * a square and an ellipse a circle, as they do everywhere else.
 */
export function dragSelection(
  shape: SelectionShape,
  from: Point,
  to: Point,
  square: boolean,
): CanvasSelection {
  if (shape === 'lasso') return { kind: 'lasso', points: [from, to] }
  return { kind: shape, rect: box(from, to, square) }
}

/** A lasso grows a point at a time; the rest is a box between two corners. */
export function extendLasso(selection: CanvasSelection, point: Point): CanvasSelection {
  if (selection?.kind !== 'lasso') return selection
  return { kind: 'lasso', points: [...selection.points, point] }
}

/**
 * How many segments an ellipse is drawn with. Enough that the marquee reads as a curve at any
 * zoom the canvas allows, and few enough that the overlay redraws in a fraction of a frame.
 */
const ELLIPSE_SEGMENTS = 48

/**
 * The outline to stroke, in document coordinates and closed — one shape for the three, so the
 * overlay strokes a polyline and needs to know nothing about ellipses or lassos.
 */
export function selectionOutline(selection: CanvasSelection): Point[] {
  if (!selection) return []
  if (selection.kind === 'lasso') return [...selection.points]

  const { rect } = selection
  if (selection.kind === 'rect') {
    return [
      { x: rect.x, y: rect.y },
      { x: rect.x + rect.width, y: rect.y },
      { x: rect.x + rect.width, y: rect.y + rect.height },
      { x: rect.x, y: rect.y + rect.height },
    ]
  }

  const radiusX = rect.width / 2
  const radiusY = rect.height / 2
  return Array.from({ length: ELLIPSE_SEGMENTS }, (_, step) => {
    const angle = (step / ELLIPSE_SEGMENTS) * Math.PI * 2
    return {
      x: rect.x + radiusX * (1 + Math.cos(angle)),
      y: rect.y + radiusY * (1 + Math.sin(angle)),
    }
  })
}

/**
 * Whether a selection encloses nothing at all — a click that carved no region, or a lasso that
 * never moved. Left standing, such a selection is a stencil nothing gets through, and every
 * later stroke writes nothing while looking exactly like a bug in the brush.
 */
export function isEmptySelection(selection: CanvasSelection): boolean {
  if (!selection) return false
  if (selection.kind === 'lasso') return selection.points.length < 3

  return selection.rect.width === 0 || selection.rect.height === 0
}

/** The box a selection fits in, which is what a brush stroke is clipped against first. */
export function selectionBounds(selection: CanvasSelection): Rect | null {
  if (!selection) return null
  if (selection.kind !== 'lasso') return selection.rect

  const xs = selection.points.map(point => point.x)
  const ys = selection.points.map(point => point.y)
  if (xs.length === 0) return null

  const left = Math.min(...xs)
  const top = Math.min(...ys)
  return { x: left, y: top, width: Math.max(...xs) - left, height: Math.max(...ys) - top }
}

/** Whether a point falls inside. A lasso is closed on the fly: the last point joins the first. */
export function selectionHolds(selection: CanvasSelection, point: Point): boolean {
  if (!selection) return true

  if (selection.kind === 'rect') {
    const { rect } = selection
    return (
      point.x >= rect.x &&
      point.y >= rect.y &&
      point.x <= rect.x + rect.width &&
      point.y <= rect.y + rect.height
    )
  }

  if (selection.kind === 'ellipse') {
    const { rect } = selection
    const radiusX = rect.width / 2
    const radiusY = rect.height / 2
    if (radiusX === 0 || radiusY === 0) return false

    const dx = (point.x - (rect.x + radiusX)) / radiusX
    const dy = (point.y - (rect.y + radiusY)) / radiusY
    return dx * dx + dy * dy <= 1
  }

  return windsAround(selection.points, point)
}

/**
 * Ray casting: a point is inside when a ray from it crosses the outline an odd number of times.
 * Chosen over the winding number because it needs no orientation — a lasso is drawn whichever
 * way the hand went.
 */
function windsAround(points: readonly Point[], point: Point): boolean {
  let inside = false

  for (let at = 0, previous = points.length - 1; at < points.length; previous = at, at += 1) {
    const a = points[at]
    const b = points[previous]
    if (!a || !b) continue

    const straddles = a.y > point.y !== b.y > point.y
    if (!straddles) continue
    // Where the edge crosses the ray's height, compared with the point's own x.
    if (point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }

  return inside
}

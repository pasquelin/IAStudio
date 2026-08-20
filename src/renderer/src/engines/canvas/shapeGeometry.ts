/**
 * The shape tool's arithmetic, kept out of the engine so it can be tested: jsdom has no WebGL
 * context, but a rectangle's corners are just numbers.
 *
 * Every kind is derived from the same two points — where the drag started and where the pointer
 * is now — so one gesture describes them all.
 */
import { clamp } from '@shared/numeric'
import type { Rect, ShapeKind } from './canvasState'
import type { Point } from '../core/geometry'

export type ShapeGeometry =
  | { kind: 'rectangle'; x: number; y: number; width: number; height: number }
  | { kind: 'ellipse'; x: number; y: number; radiusX: number; radiusY: number }
  | { kind: 'line'; from: Point; to: Point }
  | { kind: 'arrow'; from: Point; to: Point; head: [Point, Point] }
  | { kind: 'polygon'; points: Point[] }
  | { kind: 'star'; points: Point[] }

export type ShapeOptions = {
  /** Vertex count for the polygon, and point count for the star. */
  sides: number
  /** Shift held: squares, circles, and lines snapped to 45°. */
  constrain: boolean
}

export const MIN_SIDES = 3
export const MAX_SIDES = 12

/**
 * Whether the shape has no inside. `paintShape` leaves these two open, so a fill on one paints
 * nothing at all — which is why the panel hides the switch and `layer.shape` refuses it.
 */
export function isOpenShape(kind: ShapeKind): boolean {
  return kind === 'line' || kind === 'arrow'
}

/** The paint a shape falls back to when it is switched on, so turning one on is never a no-op. */
export const SHAPE_INK = 0x000000

/** What a shape is outlined with when nothing else says — a drawn line, a stroke switched on. */
export const DEFAULT_STROKE_WIDTH = 2

const SNAP = Math.PI / 4

/** Barb length as a share of the shaft, and how far it opens from it. */
const HEAD_RATIO = 0.25
const HEAD_SPREAD = Math.PI / 7

/** Golden-ratio waist — the proportion a five-pointed star is drawn with. */
const STAR_WAIST = 0.382

export function shapeGeometry(
  kind: ShapeKind,
  from: Point,
  to: Point,
  options: ShapeOptions,
): ShapeGeometry {
  switch (kind) {
    case 'rectangle':
      return { kind, ...box(from, to, options.constrain) }

    case 'ellipse': {
      const { x, y, width, height } = box(from, to, options.constrain)
      // Pixi takes a centre and two radii, not a bounding box.
      return { kind, x: x + width / 2, y: y + height / 2, radiusX: width / 2, radiusY: height / 2 }
    }

    case 'line':
      return { kind, from, to: options.constrain ? snapped(from, to) : to }

    case 'arrow': {
      const tip = options.constrain ? snapped(from, to) : to
      return { kind, from, to: tip, head: arrowHead(from, tip) }
    }

    case 'polygon':
      return { kind, points: ring(from, to, sideCount(options.sides), 1) }

    case 'star':
      return { kind, points: ring(from, to, sideCount(options.sides), STAR_WAIST) }
  }
}

function sideCount(sides: number): number {
  return Math.round(clamp(sides, MIN_SIDES, MAX_SIDES))
}

/** How many segments an ellipse is outlined with — enough to read as a curve at any zoom. */
const ELLIPSE_SEGMENTS = 48

/**
 * The shape as one closed polyline, in document coordinates. One form for the six, so the
 * overlay strokes a path and knows nothing about arrows or stars.
 */
export function shapeOutline(shape: ShapeGeometry): Point[] {
  switch (shape.kind) {
    case 'rectangle':
      return [
        { x: shape.x, y: shape.y },
        { x: shape.x + shape.width, y: shape.y },
        { x: shape.x + shape.width, y: shape.y + shape.height },
        { x: shape.x, y: shape.y + shape.height },
      ]
    case 'ellipse':
      return Array.from({ length: ELLIPSE_SEGMENTS }, (_, step) => {
        const angle = (step / ELLIPSE_SEGMENTS) * Math.PI * 2
        return {
          x: shape.x + shape.radiusX * Math.cos(angle),
          y: shape.y + shape.radiusY * Math.sin(angle),
        }
      })
    case 'line':
      return [shape.from, shape.to]
    case 'arrow':
      return [shape.from, shape.to, shape.head[0], shape.to, shape.head[1]]
    case 'polygon':
    case 'star':
      return [...shape.points]
  }
}

/**
 * Where a constrained drag really lands, so a stored shape needs no memory of the key that was
 * held: a square is a rectangle whose far corner was moved, not a rectangle plus a flag.
 */
export function constrainedTo(kind: ShapeKind, from: Point, to: Point, constrain: boolean): Point {
  if (!constrain) return to
  if (kind === 'line' || kind === 'arrow') return snapped(from, to)
  // A ring is drawn from its centre outwards, so holding shift changes nothing about it.
  if (kind === 'polygon' || kind === 'star') return to

  const { width, height } = box(from, to, true)
  return {
    x: from.x + width * direction(to.x - from.x),
    y: from.y + height * direction(to.y - from.y),
  }
}

/**
 * The same drag, moved so the shape's box starts at the origin: a layer draws into a texture of
 * its own, from (0, 0), and its transform is what puts it back where the hand drew it.
 *
 * Derived from the bounds rather than from the two points: a polygon is drawn from its CENTRE, so
 * the corner of its box is neither of them.
 */
export function localShape(
  kind: ShapeKind,
  from: Point,
  to: Point,
  sides: number,
  strokeWidth: number,
): { at: Point; from: Point; to: Point } {
  const bounds = shapeBounds(
    shapeGeometry(kind, from, to, { sides, constrain: false }),
    strokeWidth,
  )
  const moved = (point: Point): Point => ({ x: point.x - bounds.x, y: point.y - bounds.y })

  return { at: { x: bounds.x, y: bounds.y }, from: moved(from), to: moved(to) }
}

/** What a shape dirties, widened by the stroke it is drawn with — the undo tiles need it. */
export function shapeBounds(shape: ShapeGeometry, width: number): Rect {
  const outline = shapeOutline(shape)
  const xs = outline.map(point => point.x)
  const ys = outline.map(point => point.y)
  const margin = Math.max(1, width)

  const left = Math.min(...xs) - margin
  const top = Math.min(...ys) - margin
  return {
    x: left,
    y: top,
    width: Math.max(...xs) + margin - left,
    height: Math.max(...ys) + margin - top,
  }
}

/**
 * The path a shape traces, laid into whatever is handed in. Typed on the two calls it makes so
 * the geometry stays free of Pixi — the engine is the only thing that owns a `Graphics`.
 */
export type ShapePath = {
  moveTo: (x: number, y: number) => unknown
  lineTo: (x: number, y: number) => unknown
}

/** `false` when the shape has no vertex at all, so a caller can leave its brush alone. */
export function paintShape(path: ShapePath, shape: ShapeGeometry): boolean {
  const outline = shapeOutline(shape)
  const first = outline[0]
  if (!first) return false

  path.moveTo(first.x, first.y)
  for (const point of outline.slice(1)) path.lineTo(point.x, point.y)
  // Closed by hand: a line and an arrow are open, and closing them here is what gives the two
  // that do have an inside one to fill.
  if (shape.kind !== 'line' && shape.kind !== 'arrow') path.lineTo(first.x, first.y)
  return true
}

/** Normalised so width and height are never negative: dragging up-left is still a rectangle. */
export function box(from: Point, to: Point, constrain: boolean): Rect {
  let dx = to.x - from.x
  let dy = to.y - from.y

  if (constrain) {
    const side = Math.max(Math.abs(dx), Math.abs(dy))
    dx = side * direction(dx)
    dy = side * direction(dy)
  }

  return {
    x: Math.min(from.x, from.x + dx),
    y: Math.min(from.y, from.y + dy),
    width: Math.abs(dx),
    height: Math.abs(dy),
  }
}

/** `Math.sign` returns 0 on 0, which would collapse a constrained drag along one axis. */
function direction(value: number): number {
  return value < 0 ? -1 : 1
}

function snapped(from: Point, to: Point): Point {
  const angle = Math.round(Math.atan2(to.y - from.y, to.x - from.x) / SNAP) * SNAP
  const length = Math.hypot(to.x - from.x, to.y - from.y)
  return { x: from.x + Math.cos(angle) * length, y: from.y + Math.sin(angle) * length }
}

/** The two barbs, swept back from the tip along the shaft — so the head follows any angle. */
function arrowHead(from: Point, to: Point): [Point, Point] {
  const shaft = Math.atan2(from.y - to.y, from.x - to.x)
  const length = Math.hypot(to.x - from.x, to.y - from.y) * HEAD_RATIO

  const barb = (offset: number): Point => ({
    x: to.x + Math.cos(shaft + offset) * length,
    y: to.y + Math.sin(shaft + offset) * length,
  })

  return [barb(-HEAD_SPREAD), barb(HEAD_SPREAD)]
}

/**
 * Regular, drawn from its centre outwards — the drag distance is the circumradius. That is the
 * Figma gesture, and the only one that keeps the shape regular while it is being sized.
 *
 * A `waist` below 1 tucks every other vertex inwards, which is all a star is.
 */
function ring(centre: Point, edge: Point, count: number, waist: number): Point[] {
  const radius = Math.hypot(edge.x - centre.x, edge.y - centre.y)
  const vertices = waist < 1 ? count * 2 : count

  return Array.from({ length: vertices }, (_unused, index) => {
    // Quarter turn back, so the first vertex points up rather than right.
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / vertices
    const reach = index % 2 === 1 && waist < 1 ? radius * waist : radius
    return { x: centre.x + Math.cos(angle) * reach, y: centre.y + Math.sin(angle) * reach }
  })
}

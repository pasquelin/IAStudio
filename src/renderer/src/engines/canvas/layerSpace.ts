import type { Rect, Transform } from './canvasState'
import type { Point, Size } from '../core/geometry'

/**
 * A 2D affine map, as the six numbers Pixi's `Matrix` takes. Kept as plain data rather than as a
 * `Matrix`: this module is the arithmetic, and it has to be testable where there is no GPU.
 */
export type Affine = { a: number; b: number; c: number; d: number; tx: number; ty: number }

/**
 * Where a layer's own pixels land in the document — the same matrix Pixi composes for the sprite
 * `CanvasEngine.place` configures, written out here so the inverse can be taken without a GPU.
 *
 * Mirrors `Container.updateLocalTransform` of Pixi 8.19: `place` never touches `origin`, so the
 * origin terms of that formula drop out. A drift between the two shows up as a brush that paints
 * beside the cursor, so the two are asserted against each other rather than trusted.
 */
export function layerMatrix(transform: Transform, box: Size): Affine {
  const pivotX = transform.originX * box.width
  const pivotY = transform.originY * box.height

  const a = Math.cos(transform.rotation + transform.skewY) * transform.scaleX
  const b = Math.sin(transform.rotation + transform.skewY) * transform.scaleX
  const c = -Math.sin(transform.rotation - transform.skewX) * transform.scaleY
  const d = Math.cos(transform.rotation - transform.skewX) * transform.scaleY

  // `place` puts the node at `transform.x + pivot`, which is what cancels the pivot's own
  // displacement: an untouched layer sits at the origin whatever its origin fraction is.
  return {
    a,
    b,
    c,
    d,
    tx: transform.x + pivotX - (pivotX * a + pivotY * c),
    ty: transform.y + pivotY - (pivotX * b + pivotY * d),
  }
}

/**
 * The map back into the layer's own pixels. `null` when the layer is flattened onto a line —
 * a zero scale has no inverse, and painting through a singular map would write NaN across the
 * texture rather than nothing.
 */
export function invert(matrix: Affine): Affine | null {
  const determinant = matrix.a * matrix.d - matrix.b * matrix.c
  if (determinant === 0 || !Number.isFinite(determinant)) return null

  const a = matrix.d / determinant
  const b = -matrix.b / determinant
  const c = -matrix.c / determinant
  const d = matrix.a / determinant

  return {
    a,
    b,
    c,
    d,
    tx: -(matrix.tx * a + matrix.ty * c),
    ty: -(matrix.tx * b + matrix.ty * d),
  }
}

/**
 * `outer` after `inner` — the map that takes a point through both, in that order. What carries one
 * layer's pixels into another's: place them in the document with `inner`, then take them back into
 * the target's own pixels with `outer`.
 */
export function compose(outer: Affine, inner: Affine): Affine {
  return {
    a: outer.a * inner.a + outer.c * inner.b,
    b: outer.b * inner.a + outer.d * inner.b,
    c: outer.a * inner.c + outer.c * inner.d,
    d: outer.b * inner.c + outer.d * inner.d,
    tx: outer.a * inner.tx + outer.c * inner.ty + outer.tx,
    ty: outer.b * inner.tx + outer.d * inner.ty + outer.ty,
  }
}

export function applyTo(matrix: Affine, point: Point): Point {
  return {
    x: matrix.a * point.x + matrix.c * point.y + matrix.tx,
    y: matrix.b * point.x + matrix.d * point.y + matrix.ty,
  }
}

/**
 * The same transform, moved so that `held` — a point in the layer's own pixels — lands on
 * `target` in the document. Solved rather than written: `x`/`y` are NOT where the content is
 * once a scale or a turn is on, and the pivot term `origin × box` moves with the box.
 *
 * Exact in one step: the matrix is affine in `x`/`y` with a unit coefficient, so translating the
 * transform translates the drawn point by the same amount.
 */
export function anchoredAt(transform: Transform, box: Size, held: Point, target: Point): Transform {
  const drawn = applyTo(layerMatrix(transform, box), held)

  return { ...transform, x: transform.x + target.x - drawn.x, y: transform.y + target.y - drawn.y }
}

/**
 * The box that holds a mapped rectangle. Its four corners are mapped and re-bounded rather than
 * its origin and size scaled: under a rotation the latter is not a rectangle at all, and the
 * tiles a stroke photographs have to cover every pixel it can reach.
 */
export function mapRect(matrix: Affine, rect: Rect): Rect {
  const corners = [
    applyTo(matrix, { x: rect.x, y: rect.y }),
    applyTo(matrix, { x: rect.x + rect.width, y: rect.y }),
    applyTo(matrix, { x: rect.x, y: rect.y + rect.height }),
    applyTo(matrix, { x: rect.x + rect.width, y: rect.y + rect.height }),
  ]

  const xs = corners.map(corner => corner.x)
  const ys = corners.map(corner => corner.y)
  const left = Math.min(...xs)
  const top = Math.min(...ys)

  return { x: left, y: top, width: Math.max(...xs) - left, height: Math.max(...ys) - top }
}

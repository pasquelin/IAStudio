import { describe, expect, it } from 'vitest'
import { IDENTITY, type Rect, type Transform } from './canvas-state'
import type { Point } from './shape-geometry'
import { handleAt, handlePoints, layerBoxOf, resizeBy, rotateBy, ROTATE_OFFSET } from './handles'

const BOX: Rect = { x: 100, y: 100, width: 200, height: 100 }

/** A square document, so a box and its scale read off each other without arithmetic. */
const DOC = { width: 1000, height: 1000 }

describe('where the grips sit', () => {
  it('puts eight on the edge of the box', () => {
    const points = handlePoints(BOX)

    expect(points.nw).toEqual({ x: 100, y: 100 })
    expect(points.se).toEqual({ x: 300, y: 200 })
    expect(points.n).toEqual({ x: 200, y: 100 })
    expect(points.w).toEqual({ x: 100, y: 150 })
  })

  // Above the box, or it would sit on the north grip and neither could be taken.
  it('floats the rotation grip clear of the top edge', () => {
    expect(handlePoints(BOX).rotate).toEqual({ x: 200, y: 100 - ROTATE_OFFSET })
  })
})

describe('taking a grip', () => {
  it('finds the one under the pointer', () => {
    expect(handleAt(BOX, { x: 302, y: 199 }, 6)).toBe('se')
  })

  it('finds none in the middle of the box', () => {
    expect(handleAt(BOX, { x: 200, y: 150 }, 6)).toBeNull()
  })

  it('finds none beyond the tolerance it was given', () => {
    expect(handleAt(BOX, { x: 320, y: 200 }, 6)).toBeNull()
  })
})

describe('where a layer stands', () => {
  // The origin is where the layer is pinned, and `place` scales about it: the box grows from
  // that point, not from the top-left corner.
  it('grows about the origin the layer is pinned by', () => {
    const doubled = { ...IDENTITY, scaleX: 2, scaleY: 2 }

    expect(layerBoxOf(doubled, DOC)).toEqual({ x: -500, y: -500, width: 2000, height: 2000 })
  })

  it('is the document itself at identity', () => {
    expect(layerBoxOf(IDENTITY, DOC)).toEqual({ x: 0, y: 0, width: 1000, height: 1000 })
  })

  it('follows the layer where it was moved', () => {
    expect(layerBoxOf({ ...IDENTITY, x: 40 }, DOC)).toMatchObject({ x: 40 })
  })
})

describe('pulling a grip', () => {
  /** Where the layer stands after a grip has been dragged to `to`. */
  const pulled = (
    transform: Transform,
    handle: 'e' | 'se' | 'w' | 'n',
    to: Point,
    uniform = false,
  ) => layerBoxOf(resizeBy(transform, handle, DOC, to, uniform), DOC)

  it('doubles the width when the east grip is pulled twice as far', () => {
    expect(pulled(IDENTITY, 'e', { x: 2000, y: 500 })).toMatchObject({ width: 2000 })
  })

  /**
   * The whole point of a grip: the edge you are pulling against does not move. It used to drift
   * by the origin term, so a layer slid out from under the pointer as it was resized.
   */
  it('leaves the anchored edge exactly where it was', () => {
    const box = pulled(IDENTITY, 'e', { x: 2000, y: 500 })

    expect(box.x).toBe(0)
  })

  it('anchors the east edge when the west grip is pulled', () => {
    const box = pulled(IDENTITY, 'w', { x: -1000, y: 500 })

    expect(box.x + box.width).toBe(1000)
    expect(box.width).toBe(2000)
  })

  it('holds the anchor on a layer that was already moved and scaled', () => {
    const placed = { ...IDENTITY, x: 120, scaleX: 1.5, scaleY: 1.5 }
    const before = layerBoxOf(placed, DOC)
    const after = pulled(placed, 'e', { x: 900, y: 400 })

    expect(after.x).toBeCloseTo(before.x)
  })

  it('leaves the other axis alone for a grip on an edge', () => {
    expect(resizeBy(IDENTITY, 'e', DOC, { x: 2000, y: 9000 }, false).scaleY).toBe(1)
  })

  it('pulls both axes from a corner', () => {
    const box = pulled(IDENTITY, 'se', { x: 2000, y: 2000 })

    expect(box).toMatchObject({ width: 2000, height: 2000 })
  })

  // Shift keeps a picture's shape, as it does everywhere else in the studio.
  it('follows the longer side on both axes when the modifier is held', () => {
    const after = resizeBy(IDENTITY, 'se', DOC, { x: 2000, y: 1100 }, true)

    expect(after.scaleX).toBe(after.scaleY)
  })

  /**
   * On the result, not on one gesture's step: the steps multiply, so three collapsing drags of a
   * bounded ratio still reached a millionth — a layer with no box left to grab.
   */
  it('never scales a layer down to nothing, however many times it is collapsed', () => {
    let transform = IDENTITY
    for (let drag = 0; drag < 3; drag += 1) {
      transform = resizeBy(transform, 'e', DOC, { x: 0, y: 500 }, false)
    }

    expect(Math.abs(transform.scaleX)).toBeGreaterThanOrEqual(0.01)
  })
})

describe('turning by the rotation grip', () => {
  it('adds the angle the hand swept about the middle of the box', () => {
    // From due north of the middle to due east of it: a quarter turn.
    const after = rotateBy(IDENTITY, BOX, { x: 200, y: 50 }, { x: 300, y: 150 })

    expect(after.rotation).toBeCloseTo(Math.PI / 2)
  })

  it('adds to whatever the layer was already turned by', () => {
    const turned = { ...IDENTITY, rotation: Math.PI }
    const after = rotateBy(turned, BOX, { x: 200, y: 50 }, { x: 300, y: 150 })

    expect(after.rotation).toBeCloseTo(Math.PI + Math.PI / 2)
  })
})

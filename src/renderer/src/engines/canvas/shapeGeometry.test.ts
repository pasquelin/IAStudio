import { describe, expect, it } from 'vitest'
import {
  MAX_SIDES,
  MIN_SIDES,
  paintShape,
  SHAPE_KINDS,
  shapeBounds,
  shapeGeometry,
  shapeOutline,
  type ShapePath,
} from './shapeGeometry'

const FREE = { sides: 5, constrain: false }
const HELD = { sides: 5, constrain: true }

describe('shape geometry', () => {
  it('builds a rectangle from the drag, whichever way it went', () => {
    const forwards = shapeGeometry('rectangle', { x: 10, y: 20 }, { x: 40, y: 60 }, FREE)
    const backwards = shapeGeometry('rectangle', { x: 40, y: 60 }, { x: 10, y: 20 }, FREE)

    expect(forwards).toEqual({ kind: 'rectangle', x: 10, y: 20, width: 30, height: 40 })
    expect(backwards).toEqual(forwards)
  })

  it('squares a constrained rectangle on its longer side', () => {
    const shape = shapeGeometry('rectangle', { x: 0, y: 0 }, { x: 30, y: 100 }, HELD)

    expect(shape).toEqual({ kind: 'rectangle', x: 0, y: 0, width: 100, height: 100 })
  })

  it('keeps the drag direction when it squares', () => {
    const shape = shapeGeometry('rectangle', { x: 0, y: 0 }, { x: -30, y: -100 }, HELD)

    expect(shape).toEqual({ kind: 'rectangle', x: -100, y: -100, width: 100, height: 100 })
  })

  it('gives an ellipse a centre and two radii, not a box', () => {
    const shape = shapeGeometry('ellipse', { x: 0, y: 0 }, { x: 40, y: 20 }, FREE)

    expect(shape).toEqual({ kind: 'ellipse', x: 20, y: 10, radiusX: 20, radiusY: 10 })
  })

  it('circles a constrained ellipse', () => {
    const shape = shapeGeometry('ellipse', { x: 0, y: 0 }, { x: 40, y: 20 }, HELD)

    expect(shape).toEqual({ kind: 'ellipse', x: 20, y: 20, radiusX: 20, radiusY: 20 })
  })

  it('leaves a free line exactly where it was dragged', () => {
    const shape = shapeGeometry('line', { x: 0, y: 0 }, { x: 13, y: 7 }, FREE)

    expect(shape).toEqual({ kind: 'line', from: { x: 0, y: 0 }, to: { x: 13, y: 7 } })
  })

  it('snaps a constrained line to 45° without changing its length', () => {
    const shape = shapeGeometry('line', { x: 0, y: 0 }, { x: 100, y: 10 }, HELD)
    if (shape.kind !== 'line') throw new Error('expected a line')

    expect(shape.to.y).toBeCloseTo(0)
    expect(shape.to.x).toBeCloseTo(Math.hypot(100, 10))
  })

  it('gives an arrow two barbs that sit behind its tip', () => {
    const shape = shapeGeometry('arrow', { x: 0, y: 0 }, { x: 100, y: 0 }, FREE)
    if (shape.kind !== 'arrow') throw new Error('expected an arrow')

    // Pointing right: both barbs trail to the left of the tip, one above and one below.
    for (const barb of shape.head) expect(barb.x).toBeLessThan(shape.to.x)
    expect(Math.min(...shape.head.map(barb => barb.y))).toBeLessThan(0)
    expect(Math.max(...shape.head.map(barb => barb.y))).toBeGreaterThan(0)
  })

  it('keeps an arrow’s head symmetric about its shaft', () => {
    const shape = shapeGeometry('arrow', { x: 0, y: 0 }, { x: 60, y: 60 }, FREE)
    if (shape.kind !== 'arrow') throw new Error('expected an arrow')

    const [first, second] = shape.head
    expect(Math.hypot(first.x - 60, first.y - 60)).toBeCloseTo(
      Math.hypot(second.x - 60, second.y - 60),
    )
  })

  it('draws a regular polygon from its centre, first vertex up', () => {
    const shape = shapeGeometry('polygon', { x: 0, y: 0 }, { x: 0, y: -10 }, { ...FREE, sides: 4 })
    if (shape.kind !== 'polygon') throw new Error('expected a polygon')

    expect(shape.points).toHaveLength(4)
    expect(shape.points[0]?.x).toBeCloseTo(0)
    expect(shape.points[0]?.y).toBeCloseTo(-10)
    expect(shape.points[1]?.x).toBeCloseTo(10)
    expect(shape.points[1]?.y).toBeCloseTo(0)
  })

  it('keeps every polygon vertex on the circle the drag described', () => {
    const shape = shapeGeometry('polygon', { x: 5, y: 5 }, { x: 5, y: 25 }, { ...FREE, sides: 7 })
    if (shape.kind !== 'polygon') throw new Error('expected a polygon')

    for (const point of shape.points) {
      expect(Math.hypot(point.x - 5, point.y - 5)).toBeCloseTo(20)
    }
  })

  it('gives a star twice its point count in vertices, alternating in and out', () => {
    const shape = shapeGeometry('star', { x: 0, y: 0 }, { x: 0, y: -50 }, { ...FREE, sides: 5 })
    if (shape.kind !== 'star') throw new Error('expected a star')

    expect(shape.points).toHaveLength(10)

    const reach = shape.points.map(point => Math.hypot(point.x, point.y))
    for (let index = 0; index < reach.length; index += 2) {
      expect(reach[index]).toBeCloseTo(50)
      expect(reach[index + 1]).toBeLessThan(50)
    }
  })

  it('clamps an absurd side count rather than producing a degenerate shape', () => {
    const few = shapeGeometry('polygon', { x: 0, y: 0 }, { x: 10, y: 0 }, { ...FREE, sides: 1 })
    const many = shapeGeometry('polygon', { x: 0, y: 0 }, { x: 10, y: 0 }, { ...FREE, sides: 99 })

    if (few.kind !== 'polygon' || many.kind !== 'polygon') throw new Error('expected polygons')
    expect(few.points).toHaveLength(MIN_SIDES)
    expect(many.points).toHaveLength(MAX_SIDES)
  })

  it('collapses to a zero-size shape when the drag never moved', () => {
    for (const kind of SHAPE_KINDS) {
      expect(() => shapeGeometry(kind, { x: 8, y: 8 }, { x: 8, y: 8 }, FREE)).not.toThrow()
    }
  })
})

describe('outlining a shape', () => {
  it('closes a rectangle on its four corners', () => {
    const outline = shapeOutline({ kind: 'rectangle', x: 10, y: 20, width: 30, height: 40 })

    expect(outline).toEqual([
      { x: 10, y: 20 },
      { x: 40, y: 20 },
      { x: 40, y: 60 },
      { x: 10, y: 60 },
    ])
  })

  it('reads an ellipse as a curve rather than as its box', () => {
    const outline = shapeOutline({ kind: 'ellipse', x: 0, y: 0, radiusX: 10, radiusY: 5 })

    expect(outline.length).toBeGreaterThan(16)
    expect(outline[0]).toEqual({ x: 10, y: 0 })
  })

  // An arrow is a shaft and two barbs, traced without lifting the hand.
  it('traces an arrow through its tip twice', () => {
    const arrow = shapeGeometry('arrow', { x: 0, y: 0 }, { x: 100, y: 0 }, FREE)
    const outline = shapeOutline(arrow)

    expect(outline).toHaveLength(5)
    expect(outline[1]).toEqual(outline[3])
  })
})

describe('what a shape dirties', () => {
  // The undo tiles are photographed from it: too small, and the edge of a stroke is not restored.
  it('widens the box by the stroke it is drawn with', () => {
    const bounds = shapeBounds({ kind: 'rectangle', x: 10, y: 10, width: 20, height: 20 }, 8)

    expect(bounds).toEqual({ x: 2, y: 2, width: 36, height: 36 })
  })
})

describe('tracing a shape', () => {
  /** The two calls the geometry makes, recorded rather than drawn. */
  function recorder(): { path: ShapePath; calls: string[] } {
    const calls: string[] = []
    return {
      calls,
      path: {
        moveTo: (x, y) => calls.push(`move ${x} ${y}`),
        lineTo: (x, y) => calls.push(`line ${x} ${y}`),
      },
    }
  }

  it('closes what has an inside', () => {
    const { path, calls } = recorder()
    paintShape(path, { kind: 'rectangle', x: 0, y: 0, width: 10, height: 10 })

    expect(calls.at(-1)).toBe('line 0 0')
  })

  // A line and an arrow have no inside; closing them would draw a shape nobody asked for.
  it('leaves a line open', () => {
    const { path, calls } = recorder()
    paintShape(path, { kind: 'line', from: { x: 0, y: 0 }, to: { x: 10, y: 10 } })

    expect(calls).toEqual(['move 0 0', 'line 10 10'])
  })
})

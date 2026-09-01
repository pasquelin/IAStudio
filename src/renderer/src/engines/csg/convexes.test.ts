import { Matrix4, Vector3, type Plane } from 'three'
import { describe, expect, it } from 'vitest'
import type { CsgGraph } from '@shared/domain/csg'
import type { GeometryDescriptor } from '@shared/domain/geometry'
import { IDENTITY_TRANSFORM, type Transform } from '@shared/domain/transform'
import { DEFAULT_MATERIAL } from '../scene/sceneState'
import { convexesOfGraph, cornersOf, polytopeOf, pointsOf } from './convexes'

const NONE = new Matrix4()

const box = (width: number, height: number, depth: number): GeometryDescriptor => ({
  kind: 'box',
  width,
  height,
  depth,
})

const at = (x: number, y: number, z: number): Transform => ({
  ...IDENTITY_TRANSFORM,
  position: { x, y, z },
})

const inside = (pieces: readonly (readonly Plane[])[], point: Vector3): number =>
  pieces.filter(piece => piece.every(plane => plane.distanceToPoint(point) <= 1e-6)).length

/** A solid resting on one brush, so a shape this cannot read refuses the whole recipe. */
const around = (geometry: GeometryDescriptor): CsgGraph => ({
  base: { name: 'one', geometry, transform: IDENTITY_TRANSFORM, material: DEFAULT_MATERIAL },
  steps: [],
  collision: 'convexes',
})

/** A wall four wide, three high and a fifth thick, with a metre of window cut through it. */
const pierced = (): CsgGraph => ({
  base: {
    name: 'wall',
    geometry: box(4, 3, 0.2),
    transform: IDENTITY_TRANSFORM,
    material: DEFAULT_MATERIAL,
  },
  steps: [
    {
      operation: 'subtract',
      part: {
        name: 'window',
        geometry: box(1, 1, 1),
        transform: at(0, 0, 0),
        material: DEFAULT_MATERIAL,
      },
    },
  ],
  collision: 'convexes',
})

describe('a convex primitive read as half-spaces', () => {
  it('folds a tessellated box down to its six faces', () => {
    expect(polytopeOf(box(2, 2, 2))?.length).toBe(6)
  })

  it('gives a box back its eight corners', () => {
    const corners = cornersOf(polytopeOf(box(2, 4, 6)) ?? [])

    expect(corners).toHaveLength(8)
    expect(corners.every(corner => Math.abs(corner.x) === 1)).toBe(true)
    expect(corners.every(corner => Math.abs(corner.y) === 2)).toBe(true)
  })

  /** A torus is not convex, and its triangles bound a region it never occupied. */
  it('refuses a shape it cannot read as one convex solid', () => {
    expect(
      polytopeOf({ kind: 'torus', radius: 1, tube: 0.2, radialSegments: 8, tubularSegments: 8 }),
    ).toBeNull()
  })
})

describe('the exact subtraction ADR-25 decided on', () => {
  /**
   * 🛑 The measure that matters, and the one a piece count would not give: the hole is EMPTY and
   * the wall is whole. Counting pieces says nothing about where they are.
   */
  it('carves a hole a body can pass through, and leaves the rest solid', () => {
    const pieces = convexesOfGraph(pierced(), NONE) ?? []

    expect(inside(pieces, new Vector3(0, 0, 0))).toBe(0)
    expect(inside(pieces, new Vector3(0, 1.2, 0))).toBe(1)
    expect(inside(pieces, new Vector3(-1.5, 0, 0))).toBe(1)
    expect(inside(pieces, new Vector3(1.5, 0, 0))).toBe(1)
  })

  /** Disjoint: a partition that counted a point twice would weigh the wall twice over. */
  it('never covers one point with two pieces', () => {
    const pieces = convexesOfGraph(pierced(), NONE) ?? []

    for (let x = -1.9; x < 1.9; x += 0.31) {
      for (let y = -1.4; y < 1.4; y += 0.29) {
        expect(inside(pieces, new Vector3(x, y, 0))).toBeLessThan(2)
      }
    }
  })

  /** A cut through the whole thickness leaves four bars, and never a fifth that holds nothing. */
  it('drops the pieces the clipping empties', () => {
    expect(convexesOfGraph(pierced(), NONE)).toHaveLength(4)
  })

  it('carries the placement it is given into the pieces', () => {
    const pieces = convexesOfGraph(pierced(), new Matrix4().makeScale(2, 1, 1)) ?? []

    expect(inside(pieces, new Vector3(3.5, 0, 0))).toBe(1)
    expect(inside(pieces, new Vector3(0, 0, 0))).toBe(0)
  })

  /**
   * 🛑 Refused rather than walked: the corner walk is cubic in the face count, so a sphere of
   * nine hundred faces is a hundred million triples and a thread that does not come back.
   */
  it('refuses a solid with more faces than the cap allows', () => {
    const sphere: GeometryDescriptor = {
      kind: 'sphere',
      radius: 1,
      widthSegments: 32,
      heightSegments: 16,
    }

    expect(polytopeOf(sphere)).toBeNull()
    expect(convexesOfGraph(around(sphere), NONE)).toBeNull()
  })

  it('unites two brushes into pieces that cover both', () => {
    const graph: CsgGraph = {
      base: {
        name: 'a',
        geometry: box(2, 2, 2),
        transform: IDENTITY_TRANSFORM,
        material: DEFAULT_MATERIAL,
      },
      steps: [
        {
          operation: 'unite',
          part: {
            name: 'b',
            geometry: box(2, 2, 2),
            transform: at(3, 0, 0),
            material: DEFAULT_MATERIAL,
          },
        },
      ],
      collision: 'convexes',
    }
    const pieces = convexesOfGraph(graph, NONE) ?? []

    expect(inside(pieces, new Vector3(0, 0, 0))).toBe(1)
    expect(inside(pieces, new Vector3(3, 0, 0))).toBe(1)
    expect(inside(pieces, new Vector3(6, 0, 0))).toBe(0)
  })

  it('hands over the corners of a piece as flat triples', () => {
    const points = pointsOf(polytopeOf(box(2, 2, 2)) ?? [])

    expect(points).toHaveLength(24)
    expect([...points].every(value => Math.abs(value) === 1)).toBe(true)
  })
})

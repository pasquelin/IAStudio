import { describe, expect, it } from 'vitest'
import { csgPartOf, type CsgGraph } from '@shared/domain/csg'
import { IDENTITY_TRANSFORM } from '@shared/domain/transform'
import { DEFAULT_MATERIAL } from '../scene/sceneState'
import { shapeVolume } from './shapeVolume'

const box = (width: number, height: number, depth: number) =>
  ({ kind: 'box', width, height, depth }) satisfies Parameters<typeof shapeVolume>[0]

describe('shapeVolume', () => {
  it('measures a primitive', () => {
    expect(shapeVolume(box(4, 3, 0.2))).toBeCloseTo(2.4, 6)
  })

  /**
   * A curved shape is measured through the facets it is BUILT of, which are inscribed in it: a
   * 64-segment sphere of radius 1 reads 4.180 against the ideal 4.189. Near enough to elect a
   * matter, and it is the shape the cut will actually use.
   */
  it('measures a curved shape through the facets it is built of', () => {
    const sphere = shapeVolume({ kind: 'sphere', radius: 1, widthSegments: 64, heightSegments: 64 })

    expect(sphere).toBeLessThan((4 / 3) * Math.PI)
    expect(sphere).toBeCloseTo((4 / 3) * Math.PI, 1)
  })

  /** The whole reason the election weighs matter: the wall's BOX is 12 against the cube's 1. */
  it('calls a wall smaller than a unit cube, where its bounding box is twelve times bigger', () => {
    expect(shapeVolume(box(8, 8, 0.001))).toBeLessThan(shapeVolume(box(1, 1, 1)))
  })

  it('counts the scale a brush is placed at', () => {
    const recipe: CsgGraph = {
      base: {
        ...csgPartOf('Wall', box(1, 1, 1), DEFAULT_MATERIAL),
        transform: { ...IDENTITY_TRANSFORM, scale: { x: 4, y: 3, z: 0.2 } },
      },
      steps: [],
      collision: 'trimesh',
    }
    expect(shapeVolume(recipe)).toBeCloseTo(2.4, 6)
  })

  /**
   * An upper bound on purpose: a cut costs a whole CSG pass and this runs on the click that
   * folds. What was UNITED is added, what was taken out is not taken off — a hollowed solid still
   * counts as its outline, which is the shape a hand calls the big one.
   */
  it('adds what a recipe united and ignores what it cut away', () => {
    const brush = csgPartOf('Brush', box(1, 1, 1), DEFAULT_MATERIAL)
    const of = (operation: CsgGraph['steps'][number]['operation']) =>
      shapeVolume({
        base: csgPartOf('Base', box(2, 2, 2), DEFAULT_MATERIAL),
        steps: [{ operation, part: brush }],
        collision: 'trimesh',
      })

    expect(of('unite')).toBeCloseTo(9, 6)
    expect(of('subtract')).toBeCloseTo(8, 6)
    expect(of('intersect')).toBeCloseTo(8, 6)
  })
})

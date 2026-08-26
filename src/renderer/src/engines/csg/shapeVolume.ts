import { isCsgGraph, type CsgGraph, type CsgPart } from '@shared/domain/csg'
import type { GeometryDescriptor } from '@shared/domain/geometry'
import type { Transform } from '@shared/domain/transform'
import { cachedOn } from '../core/cachedOn'
import { geometryFor } from '../scene/threeFactory'
import { meshVolume } from './meshVolume'

/**
 * How much matter a shape holds — what elects the MATTER of a boolean, since a hand carves the
 * small out of the big and never the other way.
 *
 * 🛑 The volume, never the bounding box. A wall 4 × 3 × 0.2 has a box of 12 against a unit cube's
 * 1, and holds 2.4 of matter: the box calls it six times the bigger where it is barely twice.
 *
 * A recipe is ESTIMATED rather than evaluated — cutting one costs a full CSG pass and this runs
 * on the click that folds. The base plus whatever was united into it, an upper bound.
 */
export function shapeVolume(shape: GeometryDescriptor | CsgGraph): number {
  if (isCsgGraph(shape)) {
    return shape.steps
      .filter(step => step.operation === 'unite')
      .reduce((held, step) => held + partVolume(step.part), partVolume(shape.base))
  }

  // Held on the descriptor, which every edit of a document replaces — so identity IS the answer
  // being unchanged. Building the geometry is what costs: a 128-segment sphere measured 2.26 ms
  // against 0.18 for the sum alone, and a fold reads one per shape it was given.
  return cachedOn(measured, shape, () => Math.abs(meshVolume(geometryFor(shape))))
}

const measured = new WeakMap<GeometryDescriptor, number>()

function partVolume(part: CsgPart): number {
  return shapeVolume(part.geometry) * scaleOf(part.transform)
}

/** How much a placement swells what it holds. The scales alone: a turn changes no volume. */
function scaleOf(transform: Transform): number {
  return Math.abs(transform.scale.x * transform.scale.y * transform.scale.z)
}

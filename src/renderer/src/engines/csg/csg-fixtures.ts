import { type CsgGraph, type CsgPart } from '@shared/domain/csg'

/** A solid as it is born: one brush, nothing taken out of it yet. */
export function csgGraphOf(base: CsgPart): CsgGraph {
  return { base, steps: [], collision: 'trimesh' }
}

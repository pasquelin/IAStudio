import type { CsgGraph, CsgPart } from '@shared/domain/csg'
import { stableKey } from '@shared/hash'

/**
 * What makes two solids the same GEOMETRY, spelled as a string.
 *
 * ADR-25 indexes the evaluated-geometry cache on this: in an editor people copy and paste, so two
 * hundred identical windows are an ordinary Monday, and sharing one mesh between them is what
 * makes instancing possible at all.
 *
 * A string rather than a numeric hash, deliberately. A 32-bit hash collides at better than even
 * odds past ~77 000 entries, and a collision here does not fail — it draws the WRONG solid, with
 * every gate green. `stableKey` is what spells a descriptor the same way twice, RECURSIVELY: a
 * primitive gaining a field that is not a number would otherwise read as `[object Object]`, and
 * two different shapes would share one mesh.
 */
export function csgKeyOf(graph: CsgGraph): string {
  return stableKey([
    shapeOf(graph.base),
    ...graph.steps.map(step => [step.operation, shapeOf(step.part)]),
  ])
}

/**
 * Neither the name nor the collision fidelity is read, and that is the point: renaming a brush or
 * changing how the physics feels it leaves the mesh identical, so both must go on sharing one.
 */
function shapeOf(part: CsgPart): readonly unknown[] {
  return [part.geometry, part.transform]
}

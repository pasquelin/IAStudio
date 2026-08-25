import type { CsgGraph, CsgPart } from '@shared/domain/csg'
import type { GeometryDescriptor } from '@shared/domain/geometry'
import type { Transform, Vector3 } from '@shared/domain/transform'

/**
 * What makes two solids the same GEOMETRY, spelled as a string.
 *
 * ADR-25 indexes the evaluated-geometry cache on this: in an editor people copy and paste, so two
 * hundred identical windows are an ordinary Monday, and sharing one mesh between them is what
 * makes instancing possible at all.
 *
 * A string rather than a numeric hash, deliberately. A 32-bit hash collides at better than even
 * odds past ~77 000 entries, and a collision here does not fail — it draws the WRONG solid, with
 * every gate green. The key for a plain cut is some two hundred bytes; the exactness is worth it.
 */
export function csgKeyOf(graph: CsgGraph): string {
  return [
    partKey(graph.base),
    ...graph.steps.map(step => `${step.operation}${partKey(step.part)}`),
  ].join('|')
}

/**
 * Neither the name nor the collision fidelity is read, and that is the point: renaming a brush or
 * changing how the physics feels it leaves the mesh identical, so both must go on sharing one.
 */
function partKey(part: CsgPart): string {
  return `${geometryKey(part.geometry)}@${transformKey(part.transform)}`
}

/**
 * Written field by field rather than through `JSON.stringify`: object key order is the insertion
 * order, and two descriptors built by different paths would serialize differently while
 * describing the same shape — a cache miss nothing would ever explain.
 *
 * Numbers are not rounded. Rounding would merge solids that differ by less than the tolerance,
 * and being handed a neighbour's geometry is a worse failure than evaluating twice.
 */
function geometryKey(geometry: GeometryDescriptor): string {
  const fields = Object.keys(geometry)
    .filter(field => field !== 'kind')
    // By code unit, never by locale: this orders a cache key, and a collator would make the
    // same solid hash differently under a different language.
    .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
    .map(field => `${field}:${String(geometry[field as keyof GeometryDescriptor])}`)
  return [geometry.kind, ...fields].join(',')
}

function transformKey(transform: Transform): string {
  return [transform.position, transform.rotation, transform.scale].map(vectorKey).join(';')
}

function vectorKey(vector: Vector3): string {
  return `${vector.x},${vector.y},${vector.z}`
}

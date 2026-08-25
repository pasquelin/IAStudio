/**
 * Laying what is dragged onto whatever is under it.
 *
 * The two halves a drop is made of, kept apart from the ray that finds the surface: the turn is
 * applied first and the lift measured after it, or an object tipped onto a slope sinks by however
 * much its own rotation just changed its lowest point.
 *
 * Object maths, like `pivot.ts` — no WebGL context, and tested as such.
 */
import { Vector3, type Box3, type Object3D, type Quaternion } from 'three'

/** Metres above the box a downward ray starts from, so a face flush with it is not missed. */
const RAY_LIFT = 0.001

const UP = new Vector3(0, 1, 0)

/** Where a downward ray starts to find what a box is standing over, written into `out`. */
export function surfaceRayFrom(box: Box3, out: Vector3): Vector3 {
  box.getCenter(out)
  out.y = box.max.y + RAY_LIFT
  return out
}

/** Metres to raise what is dragged so its lowest point rests `offset` above `surfaceY`. */
export function surfaceLift(bottomY: number, surfaceY: number, offset: number): number {
  return surfaceY + offset - bottomY
}

/**
 * The turn that lays what is dragged along a slope, written into `out`.
 *
 * Composed onto what the object already wears rather than replacing it: a prop dropped on a ramp
 * keeps the heading it was given, and only its up leaves the vertical.
 */
export function surfaceTurn(normal: Vector3, held: Quaternion, out: Quaternion): Quaternion {
  // From where the object's up ALREADY points, not from the world's: composing a turn measured
  // off `UP` onto a `held` that tilts sends the up to `held · normal`, which is the slope only
  // when `held` leaves the vertical alone. A pivot wearing the anchor's orientation never does.
  const upright = UP.clone().applyQuaternion(held)
  return out.setFromUnitVectors(upright, normal.clone().normalize()).multiply(held)
}

/**
 * Whether the ray met the very thing being dragged, or anything hanging under it.
 *
 * The whole chain, not the parent alone: node objects nest, so a dragged group's own children are
 * two levels down. Left in, the drag lands on its own child and stops moving for the rest of the
 * gesture — with nothing to say why.
 */
export function heldBy(object: Object3D, held: Object3D): boolean {
  for (let node: Object3D | null = object; node; node = node.parent) {
    if (node === held) return true
  }

  return false
}

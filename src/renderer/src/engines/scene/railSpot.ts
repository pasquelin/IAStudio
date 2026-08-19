import { Plane, Vector3, type Ray } from 'three'

const PLANE = new Plane()
const LEVEL = new Vector3(0, 1, 0)

/**
 * Where a click that met no scenery lays a point: the level plane through `anchor`, and failing
 * that the one `facing` stands across — its length is free, the intersection cancels it.
 *
 * The second is not a nicety. A ray cast from a view looking dead level — the front and the side
 * panes of a quad view are exactly that — runs parallel to the first plane and meets it nowhere.
 */
export function spotOnRay(ray: Ray, anchor: Vector3, facing: Vector3): Vector3 | null {
  const spot = new Vector3()
  if (ray.intersectPlane(PLANE.setFromNormalAndCoplanarPoint(LEVEL, anchor), spot)) return spot

  return ray.intersectPlane(PLANE.setFromNormalAndCoplanarPoint(facing, anchor), spot)
}

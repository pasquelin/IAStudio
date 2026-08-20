import { OrthographicCamera, PerspectiveCamera, type Camera, type Vector3 } from 'three'
import { toRadians } from '@shared/domain/angles'

/**
 * How much of the world a perspective camera shows across its height, at that distance.
 *
 * Written once and read by three: this, the frustum a quad view fits to its perspective, and the
 * distance `framingDistance` backs out of it by inverting the same tangent. The vertical field
 * of view is what three counts in — `PerspectiveCamera.fov` — so the half-angle is half of it.
 */
export function frustumHeight(fieldOfView: number, distance: number): number {
  return 2 * distance * Math.tan(toRadians(fieldOfView) / 2)
}

/**
 * The world radius an object must have to cover `share` of the visible height, at that point.
 *
 * The height rather than the width: a viewport is divided into panes of any proportion, and the
 * width of what a camera shows follows the aspect ratio while the height does not.
 *
 * A camera of neither kind is left at `share`, which is what an orthographic one at zoom 1 over a
 * one-unit frustum would give: nothing in the studio builds one, and a mark of no size at all
 * would be a mark nobody can click.
 */
export function screenScale(camera: Camera, at: Vector3, share: number): number {
  if (camera instanceof OrthographicCamera) {
    return ((camera.top - camera.bottom) / camera.zoom) * share
  }
  if (camera instanceof PerspectiveCamera) {
    // The distance to the POINT, not to the plane the camera looks at: a rail runs away from the
    // view, and its far end is further than its near one by exactly what this reads.
    return frustumHeight(camera.fov, camera.position.distanceTo(at)) * share
  }
  return share
}

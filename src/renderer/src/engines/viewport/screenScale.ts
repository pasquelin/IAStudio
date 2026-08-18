import { OrthographicCamera, PerspectiveCamera, type Camera, type Vector3 } from 'three'

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
    const height = 2 * camera.position.distanceTo(at) * Math.tan((camera.fov * Math.PI) / 360)
    return height * share
  }
  return share
}

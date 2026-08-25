import type { Box3, Camera, OrthographicCamera, PerspectiveCamera, Vector3 } from 'three'

/**
 * How big the transform handles are allowed to be: never wider than what they hold.
 *
 * `TransformControls` divides the distance out of its own scale, so the handles keep one size on
 * SCREEN however far the camera stands. That is what every 3D application does — a handle that
 * shrank away would be impossible to grab — but it also means a small object ends up inside a
 * gizmo several times its width. Capped here, the handles follow the object once it is the
 * smaller of the two, and hold their screen size the rest of the time.
 */

/**
 * three's own, from `TransformControls.updateMatrixWorld` — copied rather than approximated,
 * for the same reason `projectionShader` copies `equirectUv`: a scale derived any other way
 * would put the cap somewhere other than where the handles actually are.
 */
export function screenFactor(camera: Camera, from: Vector3, at: Vector3): number {
  const orthographic = camera as OrthographicCamera
  if (orthographic.isOrthographicCamera) {
    return (orthographic.top - orthographic.bottom) / orthographic.zoom
  }

  const lens = camera as PerspectiveCamera
  return at.distanceTo(from) * Math.min((1.9 * Math.tan((Math.PI * lens.fov) / 360)) / lens.zoom, 7)
}

/** Half the diagonal of what is held, or 0 for a node with no geometry — a light, a camera. */
export function heldRadius(box: Box3, into: Vector3): number {
  return box.isEmpty() ? 0 : box.getSize(into).length() / 2
}

/**
 * The size to give the gizmo. `TransformControls` scales its handles by `factor * size / 4`, and
 * its rotation rings have a radius of one — so the radius on stage is exactly that product, and
 * the size that matches a radius is what this inverts.
 *
 * A radius of zero means nothing was measured: a light and a camera have no box, and their
 * handles keep the preferred size rather than collapsing to nothing.
 */
export function gizmoSizeFor(preferred: number, radius: number, factor: number): number {
  if (radius <= 0 || factor <= 0) return preferred
  return Math.min(preferred, (4 * radius) / factor)
}

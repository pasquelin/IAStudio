import type { Box3, Camera, OrthographicCamera, PerspectiveCamera, Vector3 } from 'three'

// How big the transform handles are allowed to be: never wider than what they hold.
// `TransformControls` keeps them one SCREEN size however far the camera stands, which puts a
// small object inside a gizmo several times its width. The cap is what makes them follow it.

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
 * How far the OUTERMOST handle of each mode reaches, in the gizmo's own space. Read off
 * `TransformControls`: the arrows and the scale boxes sit at 0.5, the rotation's outer ring is a
 * `CircleGeometry( 0.75, 1 )`. Taking them for 1 — which nothing there is — left the handles a
 * quarter short of what they were meant to wrap.
 */
const REACH: Record<GizmoMode, number> = { translate: 0.5, rotate: 0.75, scale: 0.5 }

export type GizmoMode = 'translate' | 'rotate' | 'scale'

/**
 * The size to give the gizmo so its outermost handle lands on the radius of what it holds.
 * `TransformControls` scales by `factor * size / 4`, so that handle stands at
 * `factor * size / 4 * REACH` — and this inverts it.
 *
 * A radius of zero means nothing was measured: a light and a camera have no box, and their
 * handles keep the preferred size rather than collapsing to nothing.
 */
export function gizmoSizeFor(
  preferred: number,
  radius: number,
  factor: number,
  mode: GizmoMode,
): number {
  if (radius <= 0 || factor <= 0) return preferred
  return Math.min(preferred, (4 * radius) / (REACH[mode] * factor))
}

/** Where the outermost handle of a mode lands, for a size and a factor. What the cap aims at. */
export function gizmoReachOf(size: number, factor: number, mode: GizmoMode): number {
  return ((factor * size) / 4) * REACH[mode]
}

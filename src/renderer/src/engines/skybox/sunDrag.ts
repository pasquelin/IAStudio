import { directionFromAngles, type SphericalAngles } from '@shared/domain/angles'
import type { Vector3 } from '@shared/domain/scene'

/**
 * Which gesture a drag inside a skybox is. There is no widget to aim at — the sun is a bright
 * patch of the picture — so the pointer decides by where it is looking: close enough to the
 * sun and the drag moves it, anywhere else and the drag turns the head.
 *
 * No raycast against a sphere is needed for this. With the camera at the centre, the ray's
 * direction *is* the direction being looked at, which is the same thing the sun is stored as.
 */
export type SkyboxGesture = 'sun' | 'look'

/** Radians. About fifteen degrees — a comfortable target without stealing ordinary drags. */
export const SUN_GRAB_ANGLE = 0.26

/** Cosine of the angle between two directions. Both are assumed unit length. */
function alignment(a: Vector3, b: Vector3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

export function gestureFor(
  rayDirection: Vector3,
  sun: SphericalAngles,
  tolerance: number = SUN_GRAB_ANGLE,
): SkyboxGesture {
  // Compared as a cosine rather than an angle: it avoids an `acos` per pointer move, and the
  // comparison flips the same way because cosine decreases over the range that matters.
  return alignment(rayDirection, directionFromAngles(sun)) >= Math.cos(tolerance) ? 'sun' : 'look'
}

// SPDX-License-Identifier: MIT

import type { Vector3 } from '@shared/domain/transform'

/**
 * The pivot an arm turns around. Apart from the system so the viewport can draw a resting arm
 * from the very lines the game will ride — a second copy is how a helper comes to draw another.
 */
export function armPivot(
  anchor: Vector3,
  height: number,
  shoulder: number,
  yaw: number,
  into: Vector3,
): Vector3 {
  into.x = anchor.x + Math.cos(yaw) * shoulder
  into.y = anchor.y + height
  into.z = anchor.z - Math.sin(yaw) * shoulder
  return into
}

/** The seat itself: the pivot pushed back along the look, by the length asked for. */
export function armSeat(pivot: Vector3, ahead: Vector3, length: number, into: Vector3): Vector3 {
  into.x = pivot.x - ahead.x * length
  into.y = pivot.y - ahead.y * length
  into.z = pivot.z - ahead.z * length
  return into
}

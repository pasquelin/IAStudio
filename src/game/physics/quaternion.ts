// SPDX-License-Identifier: MIT

import type { Vector3 } from '@shared/domain/transform'

export type Quaternion = { x: number; y: number; z: number; w: number }

/**
 * Intrinsic XYZ — what three.js reads an `Euler` in by default, so what every angle already
 * written in a document means. By hand rather than through three, which an exported game would
 * then carry whole for two conversions.
 */
export function quaternionFromEuler(angles: Vector3, into = SPUN()): Quaternion {
  const c1 = Math.cos(angles.x / 2)
  const c2 = Math.cos(angles.y / 2)
  const c3 = Math.cos(angles.z / 2)
  const s1 = Math.sin(angles.x / 2)
  const s2 = Math.sin(angles.y / 2)
  const s3 = Math.sin(angles.z / 2)

  into.x = s1 * c2 * c3 + c1 * s2 * s3
  into.y = c1 * s2 * c3 - s1 * c2 * s3
  into.z = c1 * c2 * s3 + s1 * s2 * c3
  into.w = c1 * c2 * c3 - s1 * s2 * s3
  return into
}

const SPUN = (): Quaternion => ({ x: 0, y: 0, z: 0, w: 1 })

/**
 * The same convention back. Written INTO the vector it is given: a step reads a pose per body per
 * frame, and a fresh object each would be the only allocation a settled scene still made.
 */
export function eulerFromQuaternion(rotation: Quaternion, into: Vector3): Vector3 {
  const { x, y, z, w } = rotation
  const x2 = x + x
  const y2 = y + y
  const z2 = z + z
  const xx = x * x2
  const xy = x * y2
  const xz = x * z2
  const yy = y * y2
  const yz = y * z2
  const zz = z * z2
  const wx = w * x2
  const wy = w * y2
  const wz = w * z2

  const m11 = 1 - (yy + zz)
  const m12 = xy - wz
  const m13 = xz + wy
  const m22 = 1 - (xx + zz)
  const m23 = yz - wx
  const m32 = yz + wx
  const m33 = 1 - (xx + yy)

  into.y = Math.asin(Math.max(-1, Math.min(1, m13)))
  // Straight up or straight down: the first and third angles turn about the SAME axis there, so
  // only their sum is defined. three.js hands the whole of it to the first, and so does this.
  if (Math.abs(m13) < 0.9999999) {
    into.x = Math.atan2(-m23, m33)
    into.z = Math.atan2(-m12, m11)
  } else {
    into.x = Math.atan2(m32, m22)
    into.z = 0
  }

  return into
}

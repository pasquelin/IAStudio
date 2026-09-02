// SPDX-License-Identifier: MIT

import type { ScenePlay } from '@shared/domain/scene'
import type { Vector3 } from '@shared/domain/transform'
import type { CameraView } from '../ports/renderPort'

/** Where the head is pointed, in radians. Yaw turns, pitch tips. */
export type Look = { yaw: number; pitch: number }

/**
 * How far behind the shoulder the camera hangs, and how high a plan view stands and stands off.
 * A SHOULDER: what is driven asks for its own stand-off, a nine-metre plane being inside this one.
 */
const OVER_SHOULDER = 5
const OVERHEAD_HEIGHT = 12
const OVERHEAD_BACK = 4

/**
 * Where the scene is watched from, given how it says it is WALKED. `feet` is the contact with the
 * floor, never the centre: a document writes `eyeHeight` as metres above the ground.
 *
 * 🛑 Nothing for `orbit`, and nothing for a mode this does not know — a fifth `PlayCamera` leaves
 * the camera alone rather than silently behaving like a third-person one. The view is REWRITTEN
 * in place, like a port's arrays: read it within the frame, never keep it.
 */
export function playView(
  play: ScenePlay,
  feet: Vector3,
  look: Look,
  back = OVER_SHOULDER,
): CameraView | null {
  if (play.camera === 'orbit') return null

  VIEW.target.x = feet.x
  VIEW.target.y = feet.y + play.eyeHeight
  VIEW.target.z = feet.z

  if (play.camera === 'topDown') {
    VIEW.position.x = feet.x
    VIEW.position.y = feet.y + OVERHEAD_HEIGHT
    VIEW.position.z = feet.z + OVERHEAD_BACK
    return VIEW
  }

  const flat = Math.cos(look.pitch)
  const aheadX = -Math.sin(look.yaw) * flat
  const aheadY = Math.sin(look.pitch)
  const aheadZ = -Math.cos(look.yaw) * flat

  if (play.camera === 'firstPerson') {
    VIEW.position.x = VIEW.target.x
    VIEW.position.y = VIEW.target.y
    VIEW.position.z = VIEW.target.z
    VIEW.target.x += aheadX
    VIEW.target.y += aheadY
    VIEW.target.z += aheadZ
    return VIEW
  }

  if (play.camera === 'thirdPerson') {
    VIEW.position.x = VIEW.target.x - aheadX * back
    VIEW.position.y = VIEW.target.y - aheadY * back
    VIEW.position.z = VIEW.target.z - aheadZ * back
    return VIEW
  }

  return null
}

const VIEW: CameraView = { position: { x: 0, y: 0, z: 0 }, target: { x: 0, y: 0, z: 0 } }

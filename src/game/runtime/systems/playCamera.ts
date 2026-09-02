// SPDX-License-Identifier: MIT

import type { Transform } from '@shared/domain/transform'
import { axesOf, quaternionFromEuler, restingAxes } from '../../physics/quaternion'
import type { Characters } from '../characters'
import type { Entity } from '../entity'
import type { Pilots } from '../pilots'
import { playView, type Look } from '../playView'
import type { System, World } from '../world'

export type PlayCameraOptions = {
  characters: Characters
  /**
   * 🛑 For the reason the physics has one: a leader hanging from a group carries a LOCAL
   * transform, and a camera reading it raw framed a point the character was not at.
   */
  worldOf?: (entity: Entity) => Transform
  /** Who is driven when nobody is walked. Absent, a scene with no character frames nothing. */
  pilots?: Pilots
}

/**
 * The `camera` rank of `SYSTEM_ORDER`, which runs LAST for the reason written there: it must not
 * follow a position the physics then corrects.
 *
 * 🛑 A character is watched through the one look the pointer drives; a VEHICLE is watched from
 * behind its own nose. A car turning under a camera that only the mouse aims reads as a car
 * sliding sideways, which is why the heading is read off the machine rather than off the drag.
 */
export function createPlayCameraSystem(options: PlayCameraOptions): System {
  const { characters, worldOf, pilots } = options
  const chase: Look = { yaw: 0, pitch: 0 }
  const axes = restingAxes()
  const spun = { x: 0, y: 0, z: 0, w: 1 }

  return {
    name: 'camera',
    reads: ['CharacterController', 'Vehicle', 'Aircraft'],
    writes: [],

    lateUpdate: (world: World) => {
      const walker = characters.leader()
      const driver = walker ? null : (pilots?.leader() ?? null)
      const leader = walker ?? driver?.entity
      if (!leader) return

      const at = (worldOf ? worldOf(leader) : leader.transform).position
      const below = walker
        ? characters.capsuleOf(walker).halfHeight + characters.capsuleOf(walker).radius
        : (driver?.below ?? 0)
      FEET.x = at.x
      FEET.y = at.y - below
      FEET.z = at.z
      const look = walker ? characters.look() : headingOf(leader, axes, spun, chase)
      world.ports.render.view(playView(world.play, FEET, look, driver?.back))
    },
  }
}

/** Where the machine is pointed, read as the yaw and pitch `playView` already builds a shot from. */
function headingOf(
  entity: Entity,
  axes: ReturnType<typeof restingAxes>,
  spun: { x: number; y: number; z: number; w: number },
  into: Look,
): Look {
  const { forward } = axesOf(quaternionFromEuler(entity.transform.rotation, spun), axes)
  into.yaw = Math.atan2(-forward.x, -forward.z)
  into.pitch = Math.asin(Math.max(-1, Math.min(1, forward.y)))
  return into
}

/** Rewritten in place: a camera is read once a frame and never kept. */
const FEET = { x: 0, y: 0, z: 0 }

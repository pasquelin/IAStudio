// SPDX-License-Identifier: MIT

import { clamp } from '../../numeric'
import { axesOfEuler, restingAxes, type Axes } from '../../physics/quaternion'
import type { Transform } from '@shared/domain/transform'
import type { Characters } from '../characters'
import type { Entity } from '../entity'
import { PILOT_RANK, type Pilots } from '../pilots'
import { OVER_SHOULDER, playView, type Look } from '../playView'
import type { System, World } from '../world'

export type PlayCameraOptions = {
  characters: Characters
  /** A leader hanging from a group carries a LOCAL transform, which frames a point it is not at. */
  worldOf?: (entity: Entity) => Transform
  /** The one seat, which this system fills for a walker and reads for everyone. */
  pilots: Pilots
}

/**
 * 🛑 A character is watched through the one look the pointer drives; a MACHINE is watched from
 * behind its own nose. A car turning under a camera that only the mouse aims reads as a car
 * sliding sideways.
 */
export function createPlayCameraSystem(options: PlayCameraOptions): System {
  const { characters, worldOf, pilots } = options
  const chase: Look = { yaw: 0, pitch: 0 }
  const axes = restingAxes()

  return {
    name: 'camera',
    reads: ['CharacterController', 'Vehicle', 'Aircraft'],
    writes: [],

    // The walker claims the seat here rather than in its own system: it has none, `characters`
    // being driven by the physics, which runs after both machines.
    lateUpdate: (world: World) => {
      const walker = characters.leader()
      if (walker) {
        const capsule = characters.capsuleOf(walker)
        pilots.take(
          walker,
          capsule.halfHeight + capsule.radius,
          OVER_SHOULDER,
          PILOT_RANK.walker,
          world.time.tick,
        )
      }

      const seat = pilots.leader()
      if (!seat) return

      const leader = seat.entity
      const at = (worldOf ? worldOf(leader) : leader.transform).position
      FEET.x = at.x
      FEET.y = at.y - seat.below
      FEET.z = at.z
      const look = leader === walker ? characters.look() : headingOf(leader, axes, chase)
      world.ports.render.view(playView(world.play, FEET, look, seat.back))
    },
  }
}

/** Where the machine is pointed, as the yaw and pitch `playView` already builds a shot from. */
function headingOf(entity: Entity, axes: Axes, into: Look): Look {
  const { forward } = axesOfEuler(entity.transform.rotation, axes)
  into.yaw = Math.atan2(-forward.x, -forward.z)
  into.pitch = Math.asin(clamp(forward.y, -1, 1))
  return into
}

/** Rewritten in place: a camera is read once a frame and never kept. */
const FEET = { x: 0, y: 0, z: 0 }

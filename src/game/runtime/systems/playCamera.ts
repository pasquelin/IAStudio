// SPDX-License-Identifier: MIT

import { clamp } from '../../numeric'
import { axesOfEuler, restingAxes, type Axes } from '../../physics/quaternion'
import type { Transform, Vector3 } from '@shared/domain/transform'
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

    /**
     * 🛑 The walker claims here — it has no system of its own — and the seat is RELEASED once the
     * view is composed: a car destroyed mid-game stops claiming, and a seat nobody emptied would
     * frame a dead entity for the rest of the session.
     */
    lateUpdate: (world: World) => {
      const walker = characters.leader()
      if (walker) {
        const capsule = characters.capsuleOf(walker)
        pilots.take(walker, capsule.halfHeight + capsule.radius, OVER_SHOULDER, PILOT_RANK.walker)
      }

      const seat = pilots.leader()
      pilots.release()
      if (!seat) return

      // 🛑 The world transform for BOTH: framed at a composed point from a rotation read in a
      // parent's frame, a chase camera sits in the wrong direction behind a parented machine.
      const placed = worldOf ? worldOf(seat.entity) : seat.entity.transform
      FEET.x = placed.position.x
      FEET.y = placed.position.y - seat.below
      FEET.z = placed.position.z
      const look =
        seat.entity === walker ? characters.look() : headingOf(placed.rotation, axes, chase)
      world.ports.render.view(playView(world.play, FEET, look, seat.back))
    },
  }
}

/** Where the machine is pointed, as the yaw and pitch `playView` already builds a shot from. */
function headingOf(rotation: Vector3, axes: Axes, into: Look): Look {
  const { forward } = axesOfEuler(rotation, axes)
  into.yaw = Math.atan2(-forward.x, -forward.z)
  into.pitch = Math.asin(clamp(forward.y, -1, 1))
  return into
}

/** Rewritten in place: a camera is read once a frame and never kept. */
const FEET = { x: 0, y: 0, z: 0 }

// SPDX-License-Identifier: MIT

import type { Transform } from '@shared/domain/transform'
import type { Characters } from '../characters'
import type { Entity } from '../entity'
import { playView } from '../playView'
import type { System, World } from '../world'

/**
 * The `camera` rank of `SYSTEM_ORDER`, which runs LAST for the reason written there: it must not
 * follow a position the physics then corrects. It watches the first entity declaring a controller.
 *
 * 🛑 `worldOf` for the same reason the physics has one: a leader hanging from a group carries a
 * LOCAL transform, and a camera reading it raw framed a point the character was not at. Absent,
 * the two are the same thing.
 */
export function createPlayCameraSystem(
  characters: Characters,
  worldOf?: (entity: Entity) => Transform,
): System {
  return {
    name: 'camera',
    reads: ['CharacterController'],
    writes: [],

    lateUpdate: (world: World) => {
      const leader = characters.leader()
      if (!leader) return

      const at = (worldOf ? worldOf(leader) : leader.transform).position
      const capsule = characters.capsuleOf(leader)
      FEET.x = at.x
      FEET.y = at.y - capsule.halfHeight - capsule.radius
      FEET.z = at.z
      world.ports.render.view(playView(world.play, FEET, characters.look()))
    },
  }
}

/** Rewritten in place: a camera is read once a frame and never kept. */
const FEET = { x: 0, y: 0, z: 0 }

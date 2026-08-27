// SPDX-License-Identifier: MIT

import type { Characters } from '../characters'
import { playView } from '../playView'
import type { System, World } from '../world'

/**
 * The `camera` rank of `SYSTEM_ORDER`, which runs LAST for the reason written there: it must not
 * follow a position the physics then corrects. It watches the first entity declaring a controller.
 */
export function createPlayCameraSystem(characters: Characters): System {
  return {
    name: 'camera',
    reads: ['CharacterController'],
    writes: [],

    lateUpdate: (world: World) => {
      const leader = characters.leader()
      if (!leader) return

      const at = leader.transform.position
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

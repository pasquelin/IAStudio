import type { GameApi } from '@game/api/gameApi'
import { STEP_SECONDS } from '@game/runtime/gameLoop'
import { createMovementSystem } from '@game/runtime/systems/movement'
import { createWorld, type System, type World } from '@game/runtime/world'
import type { SceneState } from '@/engines/scene/sceneState'

/**
 * The edit state, translated into something that runs.
 *
 * 🛑 A COPY, down to each vector: the world writes positions in place, and sharing the document's
 * own objects would let a step edit the scene the user is editing. Nothing here holds a reference
 * back to the store either — that absence is what makes STOP restore nothing, because nothing was
 * touched.
 *
 * In the window rather than under `src/game`: `SceneState` is the studio's, and the runtime may
 * not import it. An exported game reads its `.gltf` instead, which is the same translation from
 * the other side.
 */
export function worldFromScene(
  documentId: string,
  state: SceneState,
  ports: GameApi,
  seed = 1,
): World {
  const world = createWorld({
    scene: { kind: 'document', id: documentId },
    ports,
    systems: SYSTEMS(),
    seed,
    step: STEP_SECONDS,
  })

  for (const node of state.nodes) {
    world.entities.add({
      id: node.id,
      name: node.name,
      transform: {
        position: { ...node.transform.position },
        rotation: { ...node.transform.rotation },
        scale: { ...node.transform.scale },
      },
      components: [...(node.components ?? [])],
    })
  }

  return world
}

/** Every system the studio runs today. A component gains its behaviour by joining this list. */
const SYSTEMS = (): readonly System[] => [createMovementSystem()]

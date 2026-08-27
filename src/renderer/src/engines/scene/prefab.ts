import { isRecord } from '@shared/guards'
import type { Vector3 } from '@shared/domain/scene'
import { newId } from '@/helpers/ids'
import { sceneFromPayload } from './sceneDocument'
import type { SceneNode } from './sceneState'

/**
 * The nodes of a prefab, ready to be put down where they are asked for.
 *
 * 🛑 A prefab is an ordinary scene DOCUMENT of the project — the same `.gltf`, read the same way.
 * There is no prefab format, and there will not be one: the plan forbids a seventh extension, and
 * a scene already holds nodes, components and a hierarchy, which is the whole of what one is.
 *
 * 🛑 Fresh IDS, and the hierarchy kept: instancing the same prefab twice must not give two nodes
 * the same id, and a child whose parent kept its old one would hang off the FIRST instance.
 */
export function instancedNodes(document: unknown, at: Vector3): SceneNode[] {
  const state = sceneFromPayload(payloadOf(document))
  const minted = new Map(state.nodes.map(node => [node.id, newId()]))

  return state.nodes.map(node => ({
    ...node,
    id: minted.get(node.id) ?? newId(),
    parentId: node.parentId === null ? null : (minted.get(node.parentId) ?? null),
    // Moved by the offset, and the ROOTS alone: a child is placed against its parent already.
    transform:
      node.parentId === null
        ? {
            ...node.transform,
            position: {
              x: node.transform.position.x + at.x,
              y: node.transform.position.y + at.y,
              z: node.transform.position.z + at.z,
            },
          }
        : node.transform,
  }))
}

/** What a document answers with, whichever half of it holds the scene. */
const payloadOf = (document: unknown): unknown =>
  isRecord(document) && 'content' in document ? document.content : document

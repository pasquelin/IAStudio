import type { DocumentFile } from '@shared/domain/document'
import type { Vector3 } from '@shared/domain/scene'
import { copiesOf, rootedIn } from './commands'
import { sceneFromGltf } from './gltfDocument'
import type { SceneNode } from './sceneState'

/** Copies of those nodes, ready to be put down at `at`: fresh ids, hierarchy kept. */
export function instancedNodes(nodes: readonly SceneNode[], at: Vector3): readonly SceneNode[] {
  // Moved by the offset, and the ROOTS alone: a child is placed against its parent already.
  return rootedIn(copiesOf(nodes, nodes), nodes).map(node =>
    node.parentId === null ? { ...node, transform: shifted(node.transform, at) } : node,
  )
}

/**
 * The nodes a prefab's FILE holds.
 *
 * 🛑 A prefab is an ordinary scene document, read through the door an open tab comes through: a
 * scene is written as glTF, and `sceneFromPayload` parses the glTF's own `nodes` — none of which
 * is ours — and answers an EMPTY scene. Measured: zero nodes instanced.
 */
export function prefabNodes(file: DocumentFile): readonly SceneNode[] {
  return sceneFromGltf(payloadOf(file)).nodes
}

const shifted = (transform: SceneNode['transform'], by: Vector3): SceneNode['transform'] => ({
  ...transform,
  position: {
    x: transform.position.x + by.x,
    y: transform.position.y + by.y,
    z: transform.position.z + by.z,
  },
})

/** 🛑 `DocumentFile.content` is serialized TEXT: a reader handed the string finds nothing in it. */
function payloadOf(file: DocumentFile): unknown {
  try {
    return JSON.parse(file.content)
  } catch {
    // A file of the project that no longer parses. The caller refuses on the empty result.
    return null
  }
}

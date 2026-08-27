import { Euler, Matrix4, Quaternion, Vector3 } from 'three'
import type { Transform, Vector3 as Plain } from '@shared/domain/transform'
import type { SceneNode } from '@/engines/scene/sceneState'

/**
 * Where a node stands in the WORLD, and how to write a world pose back into its own frame.
 *
 * 🛑 What closes the hole `worldFromScene` carried since the physics arrived: an entity's
 * transform is LOCAL, the renderer composes its parents and the physics does not, so a collider
 * under a group stood where the mesh was not. Composed here, once per build, rather than refused.
 */
export type Hierarchy = {
  /** The node's place with every parent composed in. Its own transform when it has none. */
  worldOf: (nodeId: string) => Transform
  /**
   * A world position and rotation, written back into the node's own frame.
   *
   * The inverse of the PARENT's matrix, never of the node's own: what the physics moved is the
   * body, and what the document holds is where it sits inside whatever it hangs from.
   */
  localOf: (nodeId: string, position: Plain, rotation: Plain) => Transform
}

export function createHierarchy(nodes: readonly SceneNode[]): Hierarchy {
  const byId = new Map(nodes.map(node => [node.id, node]))
  const worlds = new Map<string, Matrix4>()

  const matrixOf = (nodeId: string): Matrix4 => {
    const held = worlds.get(nodeId)
    if (held) return held

    const node = byId.get(nodeId)
    // A parent the scene does not hold: the node stands where its own transform says.
    const own = node ? matrixFrom(node.transform) : new Matrix4()
    const composed =
      node?.parentId == null ? own : new Matrix4().multiplyMatrices(matrixOf(node.parentId), own)
    worlds.set(nodeId, composed)
    return composed
  }

  return {
    worldOf: nodeId => transformFrom(matrixOf(nodeId)),

    localOf: (nodeId, position, rotation) => {
      const node = byId.get(nodeId)
      const world = matrixFrom({
        position,
        rotation,
        scale: node?.transform.scale ?? { x: 1, y: 1, z: 1 },
      })
      if (node?.parentId == null) return transformFrom(world)

      const parent = new Matrix4().copy(matrixOf(node.parentId)).invert()
      return transformFrom(new Matrix4().multiplyMatrices(parent, world))
    },
  }
}

const matrixFrom = (transform: Transform): Matrix4 =>
  new Matrix4().compose(
    new Vector3(transform.position.x, transform.position.y, transform.position.z),
    new Quaternion().setFromEuler(
      new Euler(transform.rotation.x, transform.rotation.y, transform.rotation.z),
    ),
    new Vector3(transform.scale.x, transform.scale.y, transform.scale.z),
  )

function transformFrom(matrix: Matrix4): Transform {
  const position = new Vector3()
  const rotation = new Quaternion()
  const scale = new Vector3()
  matrix.decompose(position, rotation, scale)
  const euler = new Euler().setFromQuaternion(rotation)

  return {
    position: { x: position.x, y: position.y, z: position.z },
    rotation: { x: euler.x, y: euler.y, z: euler.z },
    scale: { x: scale.x, y: scale.y, z: scale.z },
  }
}

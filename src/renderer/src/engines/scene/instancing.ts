import { InstancedMesh, Mesh, type Material, type Object3D } from 'three'
import { stableKey } from '@shared/hash'
import type { SceneNode } from './sceneState'

/**
 * The layer a mesh goes to once an `InstancedMesh` draws it in its place.
 *
 * The camera renders layer 0 alone, so nothing on this one costs a draw call — but the mesh stays
 * in the scene with its matrix up to date, which is what keeps picking, the gizmo and the
 * selection working untouched. A raycaster must enable it explicitly: see `pickableLayers`.
 */
export const DRAWN_BY_INSTANCE = 1

/**
 * Past this many nodes of one shape, drawing them one by one stops being free.
 *
 * Measured on this Mac at 1600×900: 2 000 separate meshes cost 2.68 ms a frame, 10 000 cost
 * 17.02 ms — one whole frame, 59 fps. The same 10 000 through one `InstancedMesh` cost 1.34 ms,
 * 744 fps, in a single draw call. Below this floor the grouping earns nothing and only adds a
 * second way for a mesh to be drawn.
 */
export const WORTH_INSTANCING = 64

export type InstancedGroups = {
  /**
   * Recomposes the groups from what the scene now holds. Answers how many nodes an instance
   * draws — zero when nothing reached the floor, which is the ordinary scene.
   *
   * Call it after the world matrices are up to date: the instance matrices are copied from them.
   */
  rebuild: (nodes: readonly SceneNode[], objectOf: (id: string) => Object3D | undefined) => number
  /** The engine is going away, and so are the meshes it built. */
  dispose: () => void
}

/**
 * Draws repeated shapes in one call instead of one each.
 *
 * The meshes are NOT replaced — they are moved to a layer the camera ignores. Everything that
 * reads `objects` goes on working, and the cost of keeping them is what was measured: 1.34 ms
 * against 0.01 ms for instances alone, against 17.02 ms for meshes drawn one by one.
 */
export function createInstancedGroups(host: Object3D): InstancedGroups {
  const drawn = new Map<string, InstancedMesh>()

  const clear = (): void => {
    for (const instance of drawn.values()) {
      instance.removeFromParent()
      instance.dispose()
    }
    drawn.clear()
  }

  return {
    rebuild: (nodes, objectOf) => {
      clear()

      const groups = new Map<string, Mesh[]>()
      for (const node of nodes) {
        if (node.type !== 'mesh' || !node.visible) continue
        const mesh = objectOf(node.id)
        if (!(mesh instanceof Mesh)) continue

        // Everything a draw call would have to change: the shape, and what it is painted with.
        // Two nodes that differ by any of it cannot share one call, so they are two groups.
        const key = stableKey([node.geometry, node.material])
        const held = groups.get(key)
        if (held) held.push(mesh)
        else groups.set(key, [mesh])
      }

      let instanced = 0
      for (const [key, meshes] of groups) {
        const first = meshes[0]
        if (!first) continue
        // Back to the camera's layer: a group that shrank below the floor since the last pass
        // would otherwise stay invisible with nothing drawing it.
        if (meshes.length < WORTH_INSTANCING) {
          for (const mesh of meshes) mesh.layers.set(0)
          continue
        }

        const material = materialOf(first)
        if (!material) continue

        const instance = new InstancedMesh(first.geometry, material, meshes.length)
        for (const [at, mesh] of meshes.entries()) {
          instance.setMatrixAt(at, mesh.matrixWorld)
          mesh.layers.set(DRAWN_BY_INSTANCE)
        }
        instance.instanceMatrix.needsUpdate = true
        // Its own bounds are what the frustum tests: without this the whole group is culled by
        // the box of a single instance, and a scene disappears as soon as the camera turns.
        instance.computeBoundingSphere()
        host.add(instance)
        drawn.set(key, instance)
        instanced += meshes.length
      }
      return instanced
    },

    dispose: clear,
  }
}

/** An instance draws ONE material. A mesh wearing an array of them is left to be drawn alone. */
function materialOf(mesh: Mesh): Material | null {
  return Array.isArray(mesh.material) ? (mesh.material[0] ?? null) : mesh.material
}

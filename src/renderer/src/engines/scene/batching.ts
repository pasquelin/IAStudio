import { BatchedMesh, Mesh, type BufferGeometry, type Material, type Object3D } from 'three'
import {
  acceleratedRaycast,
  computeBatchedBoundsTree,
  disposeBatchedBoundsTree,
} from 'three-mesh-bvh'
import { stableKey } from '@shared/hash'
import { byCodeUnit } from '@shared/text'
import { DRAWN_BY_INSTANCE, spellingOf, sweep, widen, type InstancedGroups } from './grouping'
import type { SceneNode } from './sceneState'

// `Mesh.prototype.raycast` is patched by `SceneRenderer`, but a `BatchedMesh` overrides it with
// a raycast of its own — one that walks every triangle of every instance without a tree.
BatchedMesh.prototype.computeBoundsTree = computeBatchedBoundsTree
BatchedMesh.prototype.disposeBoundsTree = disposeBatchedBoundsTree
BatchedMesh.prototype.raycast = acceleratedRaycast

/**
 * Draws every shape wearing one material in one call, whatever the shapes are.
 *
 * One `BatchedMesh` per material instead of one `InstancedMesh` per (geometry, material): the
 * lot holds every geometry of its members in a single buffer and culls and sorts per instance,
 * so a scene of three shapes and eight paints is eight calls where it was twenty-four groups.
 *
 * The meshes are NOT replaced — they are moved to a layer the camera ignores, exactly as
 * `createInstancedGroups` does, so everything that reads `objects` goes on working.
 *
 * 🛑 Measured on this Mac, 2026-09-02, on the real engine: the lot costs MORE CPU than the
 * instance on every scene — three walks every instance of every lot on every pass to cull and
 * sort it, 10.4 ms against 3.1 a frame on 10 000 bodies with one shadow. See RAPPORT-C1.
 */
export function createBatchedGroups(
  host: Object3D,
  ownMaterialOf: (mesh: Mesh) => Material | Material[] = mesh => mesh.material,
): InstancedGroups {
  const drawn: BatchedMesh[] = []
  /** Where a node's matrix sits, so a move can be written without walking the scene again. */
  const placed = new Map<string, { lot: BatchedMesh; slot: number }>()
  /** The node each slot of each lot stands for — what a hit on the lot resolves to. */
  const members = new WeakMap<BatchedMesh, string[]>()
  /** Whether the lots have trees for a ray to walk. Built on the first pick, not per rebuild. */
  let treesStale = true
  const paintOf = spellingOf(node => (node.type === 'mesh' ? stableKey(node.material) : ''))
  // The buffer LAYOUT is part of the key: three refuses to put an unindexed shape beside an
  // indexed one, or two attribute sets in one buffer.
  const keyOf = (node: SceneNode, mesh: Mesh): string =>
    `${paintOf(node)}|${layoutOf(mesh.geometry)}`

  const clear = (): void => {
    for (const lot of drawn) {
      lot.removeFromParent()
      // three-mesh-bvh throws on a lot that never built its trees, and most never do: a click
      // is what builds them, and a rebuild comes before one more often than not.
      if (!treesStale) lot.disposeBoundsTree()
      lot.dispose()
    }
    drawn.length = 0
    placed.clear()
    treesStale = true
  }

  return {
    rebuild: (nodes, objectOf) => {
      clear()

      let batched = 0
      for (const worn of sweep(nodes, objectOf, host, ownMaterialOf, keyOf)) {
        const first = worn.meshes[0]
        if (!first) continue

        const shapes = new Set<BufferGeometry>()
        let vertices = 0
        let indices = 0
        for (const mesh of worn.meshes) {
          if (shapes.has(mesh.geometry)) continue
          shapes.add(mesh.geometry)
          vertices += mesh.geometry.getAttribute('position')?.count ?? 0
          indices += mesh.geometry.index?.count ?? 0
        }

        const lot = new BatchedMesh(worn.meshes.length, vertices, indices, worn.material)
        lot.perObjectFrustumCulled = true
        lot.sortObjects = true
        const slotOf = new Map([...shapes].map(geometry => [geometry, lot.addGeometry(geometry)]))

        const ids: string[] = []
        for (let at = 0; at < worn.meshes.length; at += 1) {
          const mesh = worn.meshes[at]
          const id = worn.ids[at]
          if (!mesh || id === undefined) continue
          const slot = lot.addInstance(slotOf.get(mesh.geometry) ?? 0)
          lot.setMatrixAt(slot, mesh.matrixWorld)
          placed.set(id, { lot, slot })
          ids[slot] = id
        }
        members.set(lot, ids)
        // Read off the source, which `applyShadowFlags` has already written: the sources sit
        // on a layer the shadow camera never looks at.
        lot.castShadow = first.castShadow
        lot.receiveShadow = first.receiveShadow
        // The lot's own bounds are what the frustum tests the whole of it by; per instance,
        // three reads each geometry's own.
        lot.computeBoundingSphere()
        host.add(lot)
        drawn.push(lot)

        for (const mesh of worn.meshes) mesh.layers.set(DRAWN_BY_INSTANCE)
        batched += worn.meshes.length
      }
      return batched
    },

    moved: (ids, objectOf) => {
      let touched = false
      for (const id of ids) {
        const at = placed.get(id)
        const mesh = objectOf(id)
        if (!at || !(mesh instanceof Mesh)) continue

        at.lot.setMatrixAt(at.slot, mesh.matrixWorld)
        widen(at.lot.boundingSphere, mesh.geometry, mesh.matrixWorld)
        touched = true
      }
      return touched
    },

    drawn: () => drawn,

    pickable: () => {
      if (treesStale) {
        for (const lot of drawn) lot.computeBoundsTree()
        treesStale = false
      }
      return drawn
    },

    // `batchId` is the field three r185 and three-mesh-bvh both write on a `BatchedMesh` hit.
    nodeIdOf: hit =>
      hit.object instanceof BatchedMesh && hit.batchId !== undefined
        ? (members.get(hit.object)?.[hit.batchId] ?? null)
        : null,

    dispose: clear,
  }
}

const layouts = new WeakMap<BufferGeometry, string>()

/**
 * What three demands be the same across a lot: whether there is an index, and which attributes.
 * Held per geometry — the cache lends one shape to every node wearing it, and spelling the
 * attributes again for each of 50 000 nodes would cost a sort and five allocations apiece.
 */
function layoutOf(geometry: BufferGeometry): string {
  const known = layouts.get(geometry)
  if (known !== undefined) return known
  const attributes = Object.entries(geometry.attributes)
    .map(([name, attribute]) => `${name}:${attribute.itemSize}${attribute.normalized ? 'n' : ''}`)
    .sort(byCodeUnit)
  const layout = `${geometry.index ? 'i' : 'v'}${attributes.join(',')}`
  layouts.set(geometry, layout)
  return layout
}

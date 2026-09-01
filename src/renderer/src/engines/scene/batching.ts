import {
  BatchedMesh,
  Mesh,
  Vector3,
  type BufferGeometry,
  type Material,
  type Matrix4,
  type Object3D,
} from 'three'
import {
  acceleratedRaycast,
  computeBatchedBoundsTree,
  disposeBatchedBoundsTree,
} from 'three-mesh-bvh'
import { stableKey } from '@shared/hash'
import { byCodeUnit } from '@shared/text'
import { DRAWN_BY_INSTANCE, WORTH_INSTANCING, type InstancedGroups } from './instancing'
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
  /** The spelling of a node's paint, held against the node itself — see `instancing.ts`. */
  const spelled = new WeakMap<SceneNode, string>()

  const paintOf = (node: SceneNode): string => {
    const known = spelled.get(node)
    if (known !== undefined) return known
    const key = node.type === 'mesh' ? stableKey(node.material) : ''
    spelled.set(node, key)
    return key
  }

  const clear = (): void => {
    for (const lot of drawn) {
      lot.removeFromParent()
      lot.disposeBoundsTree()
      lot.dispose()
    }
    drawn.length = 0
    placed.clear()
  }

  return {
    rebuild: (nodes, objectOf) => {
      clear()

      const groups = new Map<string, Grouped>()
      for (const node of nodes) {
        if (node.type !== 'mesh') continue
        const mesh = objectOf(node.id)
        if (!(mesh instanceof Mesh) || !isDrawn(mesh, host)) continue
        // A lot draws ONE material. A mesh wearing an array of them is left to be drawn alone.
        if (Array.isArray(ownMaterialOf(mesh))) {
          mesh.layers.set(0)
          continue
        }

        // The shadow flags and the tool mark belong to the key for the reason they do in
        // `instancing.ts`: a lot carries one of each. The buffer LAYOUT does too — three refuses
        // to put an unindexed shape beside an indexed one, or two attribute sets in one buffer.
        const key = `${paintOf(node)}|${mesh.castShadow ? 1 : 0}${mesh.receiveShadow ? 1 : 0}${
          node.negative === true ? 1 : 0
        }|${layoutOf(mesh.geometry)}`
        const held = groups.get(key)
        if (held) {
          held.ids.push(node.id)
          held.meshes.push(mesh)
        } else groups.set(key, { ids: [node.id], meshes: [mesh] })
      }

      let batched = 0
      for (const worn of groups.values()) {
        const first = worn.meshes[0]
        if (!first) continue
        const material = ownMaterialOf(first)
        // Back to the camera's layer: a group that shrank below the floor since the last pass
        // would otherwise stay invisible with nothing drawing it.
        if (worn.meshes.length < WORTH_INSTANCING || Array.isArray(material)) {
          for (const mesh of worn.meshes) mesh.layers.set(0)
          continue
        }

        const shapes = new Map<BufferGeometry, number>()
        let vertices = 0
        let indices = 0
        for (const mesh of worn.meshes) {
          if (shapes.has(mesh.geometry)) continue
          shapes.set(mesh.geometry, -1)
          vertices += mesh.geometry.getAttribute('position')?.count ?? 0
          indices += mesh.geometry.index?.count ?? 0
        }

        const lot = new BatchedMesh(worn.meshes.length, vertices, indices, material)
        lot.perObjectFrustumCulled = true
        lot.sortObjects = true
        for (const geometry of shapes.keys()) shapes.set(geometry, lot.addGeometry(geometry))

        const ids: string[] = []
        for (const [at, mesh] of worn.meshes.entries()) {
          const id = worn.ids[at]
          if (id === undefined) continue
          const slot = lot.addInstance(shapes.get(mesh.geometry) ?? 0)
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
        lot.computeBoundsTree()
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
        widen(at.lot, mesh.geometry, mesh.matrixWorld)
        touched = true
      }
      return touched
    },

    // `batchId` is the field three r185 and three-mesh-bvh both write on a `BatchedMesh` hit.
    nodeIdOf: hit =>
      hit.object instanceof BatchedMesh && hit.batchId !== undefined
        ? (members.get(hit.object)?.[hit.batchId] ?? null)
        : null,

    drawn: () => drawn,

    dispose: clear,
  }
}

const REACHED = new Vector3()

/** Grows a lot's bounds to hold an instance that just moved. Only ever grows — see `instancing.ts`. */
function widen(lot: BatchedMesh, geometry: BufferGeometry, placement: Matrix4): void {
  const bounds = lot.boundingSphere
  if (!bounds) return

  const reach =
    (geometry.boundingSphere?.radius ?? 0) * placement.getMaxScaleOnAxis() +
    bounds.center.distanceTo(REACHED.setFromMatrixPosition(placement))
  if (reach > bounds.radius) bounds.radius = reach
}

/** What three demands be the same across a lot: whether there is an index, and which attributes. */
function layoutOf(geometry: BufferGeometry): string {
  const attributes = Object.entries(geometry.attributes)
    .map(([name, attribute]) => `${name}:${attribute.itemSize}${attribute.normalized ? 'n' : ''}`)
    .sort(byCodeUnit)
  return `${geometry.index ? 'i' : 'v'}${attributes.join(',')}`
}

/** What three.js would draw: this object visible, and every one it hangs from up to the host. */
function isDrawn(mesh: Object3D, host: Object3D): boolean {
  for (let at: Object3D | null = mesh; at && at !== host; at = at.parent) {
    if (!at.visible) return false
  }
  return true
}

/** The meshes of one lot and the nodes they stand for, index for index. */
type Grouped = { ids: string[]; meshes: Mesh[] }

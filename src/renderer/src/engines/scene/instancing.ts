import {
  InstancedMesh,
  Mesh,
  Vector3,
  type BufferGeometry,
  type Material,
  type Matrix4,
  type Object3D,
} from 'three'
import { stableKey } from '@shared/hash'
import { TRIANGLES_PER_REGION, regionsByGrid, type SpatialRegions } from './instanceRegions'
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
  /**
   * Writes the matrices of nodes that just moved, without rebuilding a thing — and says whether
   * any of them was drawn by an instance.
   *
   * A gesture reports its move only when it ends, so between the two an instanced node would
   * stand where the last rebuild left it. Ten nodes cost 1.4 µs at 10 000 and 3.5 µs at 40 000,
   * against 3.9 and 32.7 ms to group again. Read the world matrices before calling: they are
   * what is copied.
   */
  moved: (ids: Iterable<string>, objectOf: (id: string) => Object3D | undefined) => boolean
  /** The engine is going away, and so are the meshes it built. */
  dispose: () => void
}

/**
 * Draws repeated shapes in one call instead of one each.
 *
 * The matrices go into a `Float32Array`, where a mesh's own are doubles — measured, that costs
 * 0.30 mm of drift at 10 000 units from the origin and 3.1 mm at 100 000, so a camera-relative
 * frame buys nothing at any distance a level reaches.
 *
 * The meshes are NOT replaced — they are moved to a layer the camera ignores. Everything that
 * reads `objects` goes on working, and the cost of keeping them is what was measured: 1.34 ms
 * against 0.01 ms for instances alone, against 17.02 ms for meshes drawn one by one.
 */
export function createInstancedGroups(host: Object3D): InstancedGroups {
  const drawn: InstancedMesh[] = []
  /** Where a node's matrix sits, so a move can be written without walking the scene again. */
  const placed = new Map<string, { instance: InstancedMesh; slot: number }>()
  /**
   * The spelling of a node's shape and paint, held against the node itself.
   *
   * Spelling them cost 22.7 ms of the 26.3 ms a rebuild took on 10 000 nodes, and a rebuild runs
   * on every change of content; held, the same rebuild costs 3.9 ms, and 32.7 ms at 40 000
   * against 108. A node is replaced when it is edited and kept when it is not — `syncNode`
   * already leans on that — so a node still here is still spelled the same way.
   */
  const spelled = new WeakMap<SceneNode, string>()

  const keyOf = (node: SceneNode): string => {
    const known = spelled.get(node)
    if (known !== undefined) return known

    // Everything a draw call would have to change: the shape, and what it is painted with.
    // Two nodes that differ by any of it cannot share one call, so they are two groups.
    const key = node.type === 'mesh' ? stableKey([node.geometry, node.material]) : ''
    spelled.set(node, key)
    return key
  }

  const clear = (): void => {
    for (const instance of drawn) {
      instance.removeFromParent()
      instance.dispose()
    }
    drawn.length = 0
    placed.clear()
  }

  return {
    rebuild: (nodes, objectOf) => {
      clear()

      // Two arrays rather than one array of pairs: a pair per node is ten thousand objects
      // allocated per rebuild, which measured 1.2 ms at 10 000 and 12 ms at 40 000.
      const groups = new Map<string, Grouped>()
      for (const node of nodes) {
        if (node.type !== 'mesh') continue
        const mesh = objectOf(node.id)
        // Read off the OBJECT, never the node: `visible` is the flag three.js draws through, so
        // it already carries what the viewport isolates on top of what the document hides.
        if (!(mesh instanceof Mesh) || !isDrawn(mesh, host)) continue

        const key = keyOf(node)
        const held = groups.get(key)
        if (held) {
          held.ids.push(node.id)
          held.meshes.push(mesh)
        } else groups.set(key, { ids: [node.id], meshes: [mesh] })
      }

      let instanced = 0
      for (const worn of groups.values()) {
        const first = worn.meshes[0]
        if (!first) continue
        // Back to the camera's layer: a group that shrank below the floor since the last pass
        // would otherwise stay invisible with nothing drawing it.
        if (worn.meshes.length < WORTH_INSTANCING) {
          for (const mesh of worn.meshes) mesh.layers.set(0)
          continue
        }

        const material = materialOf(first)
        if (!material) continue

        const regions = splitOf(worn, first.geometry)
        for (let region = 0; region + 1 < regions.starts.length; region += 1) {
          const from = regions.starts[region] ?? 0
          const to = regions.starts[region + 1] ?? 0
          const instance = new InstancedMesh(first.geometry, material, to - from)
          let written = 0
          for (let slot = from; slot < to; slot += 1) {
            const at = regions.order[slot] ?? -1
            const mesh = worn.meshes[at]
            const id = worn.ids[at]
            if (!mesh || id === undefined) continue
            instance.setMatrixAt(written, mesh.matrixWorld)
            placed.set(id, { instance, slot: written })
            written += 1
          }
          // What was really written, so a region short of a mesh draws one fewer rather than
          // leaving the constructor's identity matrix as a copy of the shape at the origin.
          instance.count = written
          instance.instanceMatrix.needsUpdate = true
          // Its own bounds are what the frustum tests: without this the whole region is culled by
          // the box of a single instance, and a scene disappears as soon as the camera turns.
          instance.computeBoundingSphere()
          host.add(instance)
          drawn.push(instance)
        }

        for (const mesh of worn.meshes) mesh.layers.set(DRAWN_BY_INSTANCE)
        instanced += worn.meshes.length
      }
      return instanced
    },

    moved: (ids, objectOf) => {
      let touched = false
      for (const id of ids) {
        const at = placed.get(id)
        const mesh = objectOf(id)
        if (!at || !(mesh instanceof Mesh)) continue

        at.instance.setMatrixAt(at.slot, mesh.matrixWorld)
        // The slot alone rather than the whole buffer: forty thousand matrices re-uploaded per
        // pointer move is the cost this exists to give back.
        at.instance.instanceMatrix.addUpdateRange(at.slot * 16, 16)
        at.instance.instanceMatrix.needsUpdate = true
        widen(at.instance, mesh.matrixWorld)
        touched = true
      }
      return touched
    },

    dispose: clear,
  }
}

const REACHED = new Vector3()

/**
 * Grows a region's bounds to hold an instance that just moved.
 *
 * Only ever grows: a predicate that shrank under a moving object would cull geometry that is on
 * screen, and the next rebuild recomputes the bounds exactly anyway. Conservative is the only
 * safe direction here.
 */
function widen(instance: InstancedMesh, placement: Matrix4): void {
  const bounds = instance.boundingSphere
  if (!bounds) return

  const reach =
    (instance.geometry.boundingSphere?.radius ?? 0) * placement.getMaxScaleOnAxis() +
    bounds.center.distanceTo(REACHED.setFromMatrixPosition(placement))
  if (reach > bounds.radius) bounds.radius = reach
}

/**
 * The regions this group is drawn in — one holding everything when all of it together draws
 * fewer triangles than a region is worth.
 */
function splitOf({ meshes }: Grouped, geometry: BufferGeometry): SpatialRegions {
  const cells = Math.ceil((meshes.length * trianglesOf(geometry)) / TRIANGLES_PER_REGION)
  if (cells <= 1) {
    return { order: Uint32Array.from(meshes.keys()), starts: Uint32Array.of(0, meshes.length) }
  }

  // The translation read straight off the world matrix, never `decompose`: a non-uniform scale
  // inside a rotated parent shears, and a decomposed translation of a sheared matrix drifts.
  const at = new Float64Array(meshes.length * 3)
  for (const [slot, mesh] of meshes.entries()) {
    const stands = mesh.matrixWorld.elements
    at[slot * 3] = stands[12] ?? 0
    at[slot * 3 + 1] = stands[13] ?? 0
    at[slot * 3 + 2] = stands[14] ?? 0
  }
  return regionsByGrid({ at, count: meshes.length }, cells)
}

/** What three.js would draw: this object visible, and every one it hangs from up to the host. */
function isDrawn(mesh: Object3D, host: Object3D): boolean {
  for (let at: Object3D | null = mesh; at && at !== host; at = at.parent) {
    if (!at.visible) return false
  }
  return true
}

function trianglesOf(geometry: BufferGeometry): number {
  return (geometry.index?.count ?? geometry.getAttribute('position')?.count ?? 0) / 3
}

/**
 * Whether a node still belongs to the group it was in: everything a draw call is grouped by is
 * the same object it was, and only where the node stands has moved.
 *
 * Compared by REFERENCE, which the store makes meaningful — a node is replaced when it is
 * edited. A move that rebuilt the groups cost 32.7 ms on 40 000 nodes, per pointer move.
 */
export function keepsItsGroup(previous: SceneNode, node: SceneNode): boolean {
  return (
    previous.type === 'mesh' &&
    node.type === 'mesh' &&
    previous.geometry === node.geometry &&
    previous.material === node.material &&
    previous.visible === node.visible &&
    previous.parentId === node.parentId
  )
}

/** The meshes of one group and the nodes they stand for, index for index. */
type Grouped = { ids: string[]; meshes: Mesh[] }

/** An instance draws ONE material. A mesh wearing an array of them is left to be drawn alone. */
function materialOf(mesh: Mesh): Material | null {
  return Array.isArray(mesh.material) ? (mesh.material[0] ?? null) : mesh.material
}

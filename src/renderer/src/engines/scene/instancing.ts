import { InstancedMesh, Mesh, type BufferGeometry, type Material, type Object3D } from 'three'
import { stableKey } from '@shared/hash'
import { TRIANGLES_PER_REGION, regionsByGrid, type SpatialRegions } from './instanceRegions'
import {
  heldOutOfDraw,
  spellingOf,
  sweep,
  widen,
  type Grouped,
  type InstancedGroups,
} from './grouping'
import type { SceneNode } from './sceneState'

/**
 * Draws repeated shapes in one call instead of one each.
 *
 * The matrices go into a `Float32Array`, where a mesh's own are doubles — measured, that costs
 * 0.30 mm of drift at 10 000 units from the origin and 3.1 mm at 100 000, so a camera-relative
 * frame buys nothing at any distance a level reaches.
 *
 * The meshes are NOT replaced — they are moved to a layer the camera ignores. Everything that
 * reads `objects` goes on working, and what it buys was measured on this Mac at 1600×900, on
 * 10 000 shadowed spheres: a tight view fell from 12.4 ms and 9 566 draw calls to 3.7 ms and 40,
 * a wide one from 24.4 ms and 19 411 calls to 4.3 ms and 73.
 */
export function createInstancedGroups(
  host: Object3D,
  /**
   * What a mesh wears when no view has dressed it. A display mode REPLACES a material, so an
   * instance built during one would be born wearing the stand-in — and would keep it when the
   * view went back, since nothing remembers a material for an object that did not exist yet.
   */
  ownMaterialOf: (mesh: Mesh) => Material | Material[] = mesh => mesh.material,
): InstancedGroups {
  const drawn: InstancedMesh[] = []
  /** Where a node's matrix sits, so a move can be written without walking the scene again. */
  const placed = new Map<string, { instance: InstancedMesh; slot: number }>()
  const sources = heldOutOfDraw()
  // Everything a draw call would have to change: the shape, and what it is painted with. Two
  // nodes that differ by any of it cannot share one call, so they are two groups.
  const keyOf = spellingOf(node =>
    node.type === 'mesh' ? stableKey([node.geometry, node.material]) : '',
  )

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

      let instanced = 0
      for (const worn of sweep(nodes, objectOf, host, ownMaterialOf, keyOf, sources)) {
        const first = worn.meshes[0]
        if (!first) continue

        const regions = splitOf(worn, first.geometry)
        for (let region = 0; region + 1 < regions.starts.length; region += 1) {
          const from = regions.starts[region] ?? 0
          const to = regions.starts[region + 1] ?? 0
          const instance = new InstancedMesh(first.geometry, worn.material, to - from)
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
          // Read off the source, which `applyShadowFlags` has already written: the sources sit
          // on a layer the shadow camera never looks at, so without this an instanced object
          // would neither cast a shadow nor catch one.
          instance.castShadow = first.castShadow
          instance.receiveShadow = first.receiveShadow
          instance.instanceMatrix.needsUpdate = true
          // Its own bounds are what the frustum tests: without this the whole region is culled by
          // the box of a single instance, and a scene disappears as soon as the camera turns.
          instance.computeBoundingSphere()
          host.add(instance)
          drawn.push(instance)
        }

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
        widen(at.instance.boundingSphere, at.instance.geometry, mesh.matrixWorld)
        touched = true
      }
      return touched
    },

    drawn: () => drawn,

    pickable: () => [],

    nodeIdOf: () => null,

    hangSources: sources.hang,

    dropSources: sources.drop,

    refreshSources: sources.refresh,

    // The sources back in the walk with it: nothing draws for them any more.
    dispose: () => {
      clear()
      sources.hang()
    },
  }
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
    previous.parentId === node.parentId &&
    // The shadow flags and the tool mark are part of the group key: an instance carries one of
    // each, so a node that changed its mind has to leave the group rather than keep its slot.
    previous.castShadow === node.castShadow &&
    previous.receiveShadow === node.receiveShadow &&
    previous.negative === node.negative
  )
}

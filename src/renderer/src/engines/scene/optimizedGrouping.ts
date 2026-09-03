import { Mesh, type Intersection, type Material, type Object3D } from 'three'
import { createBatchedGroups } from './batching'
import { createCellGroups } from './cellInstancing'
import type { InstancedGroups } from './grouping'
import { meshesOf } from './instanceableModel'

export function createOptimizedGroups(
  host: Object3D,
  ownMaterialOf: (mesh: Mesh) => Material | Material[] = mesh => mesh.material,
): InstancedGroups {
  const instances = createCellGroups(host, ownMaterialOf)
  const batches = createBatchedGroups(host, ownMaterialOf)

  return {
    rebuild: (nodes, objectOf, excluded) => {
      instances.hangSources()
      batches.hangSources()
      for (const node of nodes) {
        const object = objectOf(node.id)
        if (object instanceof Mesh) object.layers.set(0)
        else if (object) for (const mesh of meshesOf(object)) mesh.layers.set(0)
      }
      const modeById = new Map(nodes.map(node => [node.id, node.optimization?.mode ?? 'auto']))
      const forInstances = (id: string): Object3D | undefined =>
        modeById.get(id) === 'auto' || modeById.get(id) === 'instance' ? objectOf(id) : undefined
      const forBatches = (id: string): Object3D | undefined =>
        modeById.get(id) === 'batch' ? objectOf(id) : undefined
      const grouped =
        instances.rebuild(nodes, forInstances, excluded) +
        batches.rebuild(nodes, forBatches, excluded)
      instances.dropSources()
      batches.dropSources()
      return grouped
    },
    moved: (ids, objectOf) => {
      const movedIds = [...ids]
      const movedInstances = instances.moved(movedIds, objectOf)
      const movedBatches = batches.moved(movedIds, objectOf)
      return movedInstances || movedBatches
    },
    drawn: () => [...instances.drawn(), ...batches.drawn()],
    pickable: () => [...instances.pickable(), ...batches.pickable()],
    nodeIdOf: (hit: Intersection) => instances.nodeIdOf(hit) ?? batches.nodeIdOf(hit),
    hangSources: () => {
      instances.hangSources()
      batches.hangSources()
    },
    dropSources: () => {
      instances.dropSources()
      batches.dropSources()
    },
    refreshSources: () => {
      instances.refreshSources()
      batches.refreshSources()
    },
    holdsSource: object => instances.holdsSource(object) || batches.holdsSource(object),
    follow: (camera, cast) => instances.follow?.(camera, cast) ?? false,
    builtAnew: () => instances.builtAnew?.() ?? false,
    stats: () =>
      instances.stats?.() ?? {
        nodesVisited: 0,
        cellsReturned: 0,
        cellsStanding: 0,
        cells: 0,
        bytes: 0,
      },
    dispose: () => {
      instances.dispose()
      batches.dispose()
    },
  }
}

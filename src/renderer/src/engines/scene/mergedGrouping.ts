import { Matrix4, Mesh, type Intersection, type Material, type Object3D } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { batchKeyOf } from './batching'
import { heldOutOfDraw, trianglesOf, type InstancedGroups } from './grouping'
import type { RuntimeRenderArtifact } from './grouping'
import type { SceneNode } from './sceneState'

type FaceRange = { end: number; nodeId: string }

export function createMergedGroups(
  host: Object3D,
  ownMaterialOf: (mesh: Mesh) => Material | Material[] = mesh => mesh.material,
): InstancedGroups {
  const drawn: Mesh[] = []
  const members = new WeakMap<Mesh, readonly FaceRange[]>()
  const sources = heldOutOfDraw()
  let lastNodes: readonly SceneNode[] = []
  let lastArtifacts: readonly RuntimeRenderArtifact[] | undefined
  let lastExcluded: ReadonlySet<string> | undefined

  const clear = (): void => {
    for (const mesh of drawn) {
      mesh.removeFromParent()
      mesh.geometry.dispose()
    }
    drawn.length = 0
  }

  const rebuild: InstancedGroups['rebuild'] = (nodes, objectOf, excluded, artifacts) => {
    lastNodes = nodes
    lastArtifacts = artifacts
    lastExcluded = excluded
    clear()
    let merged = 0
    const held: Mesh[] = []
    const byId = new Map(nodes.map(node => [node.id, node]))
    const keyOf = batchKeyOf(ownMaterialOf)
    host.updateWorldMatrix(true, false)
    const worldToHost = new Matrix4().copy(host.matrixWorld).invert()
    for (const artifact of artifacts?.filter(one => one.strategy === 'merge') ?? []) {
      const groups = new Map<string, { ids: string[]; meshes: Mesh[]; material: Material }>()
      for (const id of artifact.sourceIds) {
        const node = byId.get(id)
        const mesh = objectOf(id)
        if (!node || !(mesh instanceof Mesh) || excluded?.has(id)) continue
        const material = ownMaterialOf(mesh)
        if (Array.isArray(material)) continue
        const key = keyOf(node, mesh)
        const group = groups.get(key)
        if (group) {
          group.ids.push(id)
          group.meshes.push(mesh)
        } else groups.set(key, { ids: [id], meshes: [mesh], material })
      }
      for (const group of groups.values()) {
        if (group.meshes.length < 2) continue
        const geometries = group.meshes.map(mesh =>
          mesh.geometry
            .clone()
            .applyMatrix4(new Matrix4().multiplyMatrices(worldToHost, mesh.matrixWorld)),
        )
        const geometry = mergeGeometries(geometries, false)
        for (const source of geometries) source.dispose()
        if (!geometry) continue

        const mesh = new Mesh(geometry, group.material)
        mesh.matrixAutoUpdate = false
        mesh.castShadow = group.meshes[0]?.castShadow ?? false
        mesh.receiveShadow = group.meshes[0]?.receiveShadow ?? false
        const ranges: FaceRange[] = []
        let end = 0
        for (const [index, source] of group.meshes.entries()) {
          end += trianglesOf(source.geometry)
          const nodeId = group.ids[index]
          if (nodeId) ranges.push({ end, nodeId })
        }
        members.set(mesh, ranges)
        host.add(mesh)
        drawn.push(mesh)
        held.push(...group.meshes)
        merged += group.meshes.length
      }
    }
    sources.hold(held)
    return merged
  }

  return {
    rebuild,
    moved: (ids, objectOf) => {
      const moved = [...ids].some(id => {
        const object = objectOf(id)
        return object ? sources.holds(object) : false
      })
      if (!moved) return false
      rebuild(lastNodes, objectOf, lastExcluded, lastArtifacts)
      return true
    },
    drawn: () => drawn,
    pickable: () => drawn,
    nodeIdOf: (hit: Intersection) => {
      if (!(hit.object instanceof Mesh) || hit.faceIndex === undefined || hit.faceIndex === null)
        return null
      const faceIndex = hit.faceIndex
      return members.get(hit.object)?.find(range => faceIndex < range.end)?.nodeId ?? null
    },
    hangSources: sources.hang,
    dropSources: sources.drop,
    refreshSources: sources.refresh,
    holdsSource: sources.holds,
    dispose: () => {
      clear()
      sources.hang()
    },
  }
}

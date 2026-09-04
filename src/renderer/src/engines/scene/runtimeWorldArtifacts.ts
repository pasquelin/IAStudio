import { stableKey } from '@shared/hash'
import { byCodeUnit } from '@shared/text'
import { Euler, Matrix4, Quaternion, Vector3 } from 'three'
import { DEFAULT_OPTIMIZATION_POLICY, type OptimizationPolicy } from '@shared/domain/optimizationPolicy'
import type { AnimationTimeline } from '@shared/domain/animation'
import { behavioralGroupingExclusions, type RuntimeRenderArtifact } from './grouping'
import type { SceneNode, SceneState } from './sceneState'
import type { RuntimeOptimization, RuntimeWorld } from './runtimeWorldCompiler'
import { adaptiveCellsOf, adaptiveRootCellKeyOf } from './adaptivePartition'

export type ArtifactWorldCompilation = {
  artifacts: readonly RuntimeRenderArtifact[]
  regions: Map<string, readonly RuntimeRenderArtifact[]>
  regionByNode: Map<string, string>
  regionMembers: Map<string, Set<string>>
  regional: boolean
  forcedMeshKeys: Set<string>
}

export function compileArtifactWorld(
  nodes: readonly SceneNode[],
  animation: AnimationTimeline,
): ArtifactWorldCompilation {
  if (nodes.some(node => node.parentId !== null)) {
    return {
      artifacts: runtimeArtifactsOf(nodes, animation),
      regions: new Map(),
      regionByNode: new Map(),
      regionMembers: new Map(),
      regional: false,
      forcedMeshKeys: new Set(),
    }
  }
  const regionByNode = new Map<string, string>()
  const regionMembers = new Map<string, Set<string>>()
  const excluded = behavioralGroupingExclusions(
    nodes,
    new Set(animation.tracks.map(track => track.target.nodeId)),
  )
  const forcedMeshKeys = new Set(
    nodes.flatMap(node => {
      const key = forcedMeshKeyOf(node, excluded)
      return key ? [key] : []
    }),
  )
  for (const node of nodes) {
    const region = artifactRegionOf(node)
    if (!region) continue
    regionByNode.set(node.id, region)
    const members = regionMembers.get(region)
    if (members) members.add(node.id)
    else regionMembers.set(region, new Set([node.id]))
  }
  const byId = new Map(nodes.map(node => [node.id, node]))
  const regions = new Map<string, readonly RuntimeRenderArtifact[]>()
  for (const [region, ids] of regionMembers) {
    const members = [...ids].flatMap(id => {
      const node = byId.get(id)
      return node ? [node] : []
    })
    regions.set(
      region,
      runtimeArtifactsOf(membersWithForcedInstances(members, forcedMeshKeys, animation), animation),
    )
  }
  return {
    artifacts: [...regions.values()]
      .flat()
      .sort((one, other) => byCodeUnit(one.signature, other.signature)),
    regions,
    regionByNode,
    regionMembers,
    regional: true,
    forcedMeshKeys,
  }
}

export function forcedMeshKeyOf(
  node: SceneNode | undefined,
  excludedOrDriven: ReadonlySet<string>,
): string | null {
  if (node?.type !== 'mesh' || !node.visible || node.optimization?.mode !== 'instance') return null
  const excluded = behavioralGroupingExclusions([node], excludedOrDriven)
  return excluded.has(node.id) ? null : instanceCompatibilityKeyOf(node)
}

export function membersWithForcedInstances(
  nodes: readonly SceneNode[],
  forcedKeys: ReadonlySet<string>,
  animation: AnimationTimeline,
): readonly SceneNode[] {
  const excluded = behavioralGroupingExclusions(
    nodes,
    new Set(animation.tracks.map(track => track.target.nodeId)),
  )
  const forcedInRegion = new Set(
    nodes.flatMap(node => {
      const key = forcedMeshKeyOf(node, excluded)
      return key ? [key] : []
    }),
  )
  const promoted = new Set<string>()
  return nodes.map(node => {
    if (
      node.type !== 'mesh' ||
      excluded.has(node.id) ||
      (node.optimization?.mode ?? 'auto') !== 'auto'
    ) {
      return node
    }
    const key = instanceCompatibilityKeyOf(node)
    if (!forcedKeys.has(key) || forcedInRegion.has(key) || promoted.has(key)) return node
    promoted.add(key)
    return { ...node, optimization: { ...node.optimization, mode: 'instance' } }
  })
}

function artifactRegionOf(node: SceneNode): string | null {
  const mode = node.optimization?.mode ?? 'auto'
  if (!node.visible || mode === 'individual' || mode === 'exclude') return null
  if (node.type === 'mesh') {
    return `mesh:${adaptiveRootCellKeyOf(node, DEFAULT_OPTIMIZATION_POLICY) ?? `oversize:${node.id}`}`
  }
  if (node.type !== 'model') return null
  const strategy = mode === 'auto' || mode === 'instance' ? 'instance' : mode
  return `model:${strategy}:${mode === 'batch' ? batchCompatibilityKeyOf(node) : instanceCompatibilityKeyOf(node)}`
}

export function updateArtifactRegion(
  node: SceneNode,
  regionByNode: Map<string, string>,
  regionMembers: Map<string, Set<string>>,
  affected: Set<string>,
): void {
  removeArtifactRegion(node.id, regionByNode, regionMembers)
  const region = artifactRegionOf(node)
  if (!region) return
  regionByNode.set(node.id, region)
  const members = regionMembers.get(region)
  if (members) members.add(node.id)
  else regionMembers.set(region, new Set([node.id]))
  affected.add(region)
}

export function removeArtifactRegion(
  id: string,
  regionByNode: Map<string, string>,
  regionMembers: Map<string, Set<string>>,
): void {
  const region = regionByNode.get(id)
  if (!region) return
  regionByNode.delete(id)
  const members = regionMembers.get(region)
  members?.delete(id)
  if (members?.size === 0) regionMembers.delete(region)
}

export function runtimeState(
  source: SceneState,
  nodes: readonly SceneNode[],
  artifacts: readonly RuntimeRenderArtifact[],
): RuntimeWorld {
  return {
    nodes,
    selectedIds: [],
    world: source.world,
    animation: source.animation,
    runtimeOptimization: { artifacts },
  }
}

export function runtimeArtifactsOf(
  nodes: readonly SceneNode[],
  animation: AnimationTimeline,
  policy: OptimizationPolicy = DEFAULT_OPTIMIZATION_POLICY,
): readonly RuntimeRenderArtifact[] {
  const spatialNodes = spatialNodesOf(nodes)
  const excluded = behavioralGroupingExclusions(
    nodes,
    new Set(animation.tracks.map(track => track.target.nodeId)),
  )
  const { groups, batches } = explicitGroups(nodes, spatialNodes, excluded)
  const instances = instanceArtifacts(groups, policy)
  const batchArtifacts = forcedBatchArtifacts(batches, policy)
  const selected = new Set(
    [...instances, ...batchArtifacts].flatMap(artifact => artifact.sourceIds),
  )
  const automatic = automaticStaticArtifacts(nodes, spatialNodes, excluded, selected, policy)
  return [...instances, ...batchArtifacts, ...automatic].sort((one, other) =>
    byCodeUnit(one.signature, other.signature),
  )
}

function explicitGroups(
  nodes: readonly SceneNode[],
  spatialNodes: ReadonlyMap<string, SceneNode>,
  excluded: ReadonlySet<string>,
): {
  groups: Map<string, { nodes: SceneNode[]; forced: boolean }>
  batches: Map<string, SceneNode[]>
} {
  const groups = new Map<string, { nodes: SceneNode[]; forced: boolean }>()
  const batches = new Map<string, SceneNode[]>()
  for (const node of nodes) addExplicitNode(node, spatialNodes, excluded, groups, batches)
  return { groups, batches }
}

function addExplicitNode(
  node: SceneNode,
  spatialNodes: ReadonlyMap<string, SceneNode>,
  excluded: ReadonlySet<string>,
  groups: Map<string, { nodes: SceneNode[]; forced: boolean }>,
  batches: Map<string, SceneNode[]>,
): void {
  if ((node.type !== 'mesh' && node.type !== 'model') || excluded.has(node.id) || !node.visible)
    return
  const mode = node.optimization?.mode ?? 'auto'
  const spatial = spatialNodes.get(node.id) ?? node
  if (mode === 'batch') {
    const key = batchCompatibilityKeyOf(node)
    const members = batches.get(key)
    if (members) members.push(spatial)
    else batches.set(key, [spatial])
    return
  }
  if (mode !== 'auto' && mode !== 'instance') return
  const key = instanceCompatibilityKeyOf(node)
  const group = groups.get(key)
  if (group) { group.nodes.push(spatial); group.forced ||= mode === 'instance' }
  else groups.set(key, { nodes: [spatial], forced: mode === 'instance' })
}

function batchCompatibilityKeyOf(node: Extract<SceneNode, { type: 'mesh' | 'model' }>): string {
  return stableKey([
    node.type,
    node.type === 'mesh' ? node.material : node.model.assetId,
    node.castShadow,
    node.receiveShadow,
    node.optimization?.groupId ?? null,
  ])
}

function instanceCompatibilityKeyOf(node: Extract<SceneNode, { type: 'mesh' | 'model' }>): string {
  return stableKey([
    node.type,
    node.type === 'mesh' ? [node.geometry, node.material, node.negative] : [node.model],
    node.castShadow,
    node.receiveShadow,
    node.optimization?.groupId ?? null,
  ])
}

function instanceArtifacts(
  groups: ReadonlyMap<string, { nodes: readonly SceneNode[]; forced: boolean }>,
  policy: OptimizationPolicy,
): readonly RuntimeRenderArtifact[] {
  const artifacts: RuntimeRenderArtifact[] = []
  for (const [compatibilityKey, group] of groups) {
    if (!group.forced && group.nodes.length < policy.minInstancesPerGroup) continue
    const meshes = group.nodes.filter(
      (node): node is Extract<SceneNode, { type: 'mesh' }> => node.type === 'mesh',
    )
    if (meshes.length === group.nodes.length) {
      for (const { cell, nodes } of adaptiveCellsOf(meshes, policy)) {
        if (!group.forced && nodes.length < policy.minInstancesPerGroup) continue
        pushArtifacts(artifacts, 'instance', stableKey([compatibilityKey, cell]), nodes, policy)
      }
      continue
    }
    pushArtifacts(artifacts, 'instance', compatibilityKey, group.nodes, policy)
  }
  return artifacts
}

function forcedBatchArtifacts(
  batches: ReadonlyMap<string, readonly SceneNode[]>,
  policy: OptimizationPolicy,
): readonly RuntimeRenderArtifact[] {
  const artifacts: RuntimeRenderArtifact[] = []
  for (const [compatibilityKey, candidates] of batches) {
    const meshes = candidates.filter(
      (node): node is Extract<SceneNode, { type: 'mesh' }> => node.type === 'mesh',
    )
    if (meshes.length === candidates.length) {
      for (const { cell, nodes } of adaptiveCellsOf(meshes, policy)) {
        pushArtifacts(artifacts, 'batch', stableKey([compatibilityKey, cell]), nodes, policy)
      }
      continue
    }
    pushArtifacts(artifacts, 'batch', compatibilityKey, candidates, policy)
  }
  return artifacts
}

function pushArtifacts(
  into: RuntimeRenderArtifact[],
  strategy: RuntimeRenderArtifact['strategy'],
  key: string,
  nodes: readonly SceneNode[],
  policy: OptimizationPolicy,
): void {
  const ordered = nodes.map(node => node.id).sort(byCodeUnit)
  for (let offset = 0; offset < ordered.length; offset += policy.maxObjectsPerBatch) {
    const sourceIds = ordered.slice(offset, offset + policy.maxObjectsPerBatch)
    into.push({ key, strategy, sourceIds, signature: stableKey([strategy, key, sourceIds]) })
  }
}

function automaticStaticArtifacts(
  nodes: readonly SceneNode[],
  spatialNodes: ReadonlyMap<string, SceneNode>,
  excluded: ReadonlySet<string>,
  selected: ReadonlySet<string>,
  policy: OptimizationPolicy,
): readonly RuntimeRenderArtifact[] {
  const parentIds = new Set(nodes.flatMap(node => (node.parentId ? [node.parentId] : [])))
  const compatible = compatibleStaticNodes(nodes, spatialNodes, excluded, selected, parentIds)
  const groups = spatialStaticGroups(compatible, policy)
  return staticArtifacts(groups, parentIds, policy)
}

function compatibleStaticNodes(
  nodes: readonly SceneNode[],
  spatialNodes: ReadonlyMap<string, SceneNode>,
  excluded: ReadonlySet<string>,
  selected: ReadonlySet<string>,
  parentIds: ReadonlySet<string>,
): Map<string, Extract<SceneNode, { type: 'mesh' }>[]> {
  const compatible = new Map<string, Extract<SceneNode, { type: 'mesh' }>[]>()
  for (const node of nodes) {
    if (!isAutomaticStatic(node, excluded, selected, parentIds)) continue
    const key = automaticCompatibilityKey(node)
    const members = compatible.get(key)
    const spatial = spatialNodes.get(node.id) ?? node
    if (spatial.type !== 'mesh') continue
    if (members) members.push(spatial)
    else compatible.set(key, [spatial])
  }
  return compatible
}

function isAutomaticStatic(
  node: SceneNode,
  excluded: ReadonlySet<string>,
  selected: ReadonlySet<string>,
  parentIds: ReadonlySet<string>,
): node is Extract<SceneNode, { type: 'mesh' }> {
  return node.type === 'mesh' &&
    (node.optimization?.mode === undefined || node.optimization.mode === 'auto') &&
    !excluded.has(node.id) && !selected.has(node.id) && !parentIds.has(node.id) && node.visible
}

function automaticCompatibilityKey(node: Extract<SceneNode, { type: 'mesh' }>): string {
  return stableKey([
    node.material, node.castShadow, node.receiveShadow, node.negative ?? false,
    mergeLayoutOf(node), node.optimization?.groupId ?? null,
  ])
}

function spatialStaticGroups(
  compatible: ReadonlyMap<string, Extract<SceneNode, { type: 'mesh' }>[]>,
  policy: OptimizationPolicy,
): Map<string, Extract<SceneNode, { type: 'mesh' }>[]> {
  const groups = new Map<string, Extract<SceneNode, { type: 'mesh' }>[]>()
  for (const [compatibilityKey, candidates] of compatible) {
    for (const { cell, nodes: members } of adaptiveCellsOf(candidates, policy)) {
      groups.set(stableKey([compatibilityKey, cell]), members)
    }
  }
  return groups
}

function staticArtifacts(
  groups: ReadonlyMap<string, Extract<SceneNode, { type: 'mesh' }>[]>,
  parentIds: ReadonlySet<string>,
  policy: OptimizationPolicy,
): RuntimeRenderArtifact[] {
  const artifacts: RuntimeRenderArtifact[] = []
  for (const [key, unordered] of groups) {
    const members = unordered.sort((one, other) => byCodeUnit(one.id, other.id))
    if (members.length < policy.minBatchSize) continue
    for (let offset = 0; offset < members.length; offset += policy.maxObjectsPerBatch) {
      const chunk = members.slice(offset, offset + policy.maxObjectsPerBatch)
      const canMerge =
        chunk.length >= policy.minMergeSize &&
        chunk.length <= policy.maxObjectsPerMerge &&
        chunk.every(
          node => node.parentId === null && !parentIds.has(node.id) && !node.components?.length,
        )
      const strategy = canMerge ? 'merge' : 'batch'
      const sourceIds = chunk.map(node => node.id).sort(byCodeUnit)
      artifacts.push({
        key,
        strategy,
        sourceIds,
        signature: stableKey([strategy, key, sourceIds]),
      })
    }
  }
  return artifacts
}

function mergeLayoutOf(node: SceneNode): string {
  if (node.type !== 'mesh') return ''
  switch (node.geometry.kind) {
    case 'dodecahedron':
    case 'icosahedron':
    case 'octahedron':
    case 'tetrahedron':
      return 'non-indexed'
    default:
      return 'indexed'
  }
}

function spatialNodesOf(nodes: readonly SceneNode[]): ReadonlyMap<string, SceneNode> {
  const source = new Map(nodes.map(node => [node.id, node]))
  const matrices = new Map<string, Matrix4>()
  const visiting = new Set<string>()
  const matrixOf = (node: SceneNode): Matrix4 => {
    const known = matrices.get(node.id)
    if (known) return known
    const transform = node.transform
    const local = new Matrix4().compose(
      new Vector3(transform.position.x, transform.position.y, transform.position.z),
      new Quaternion().setFromEuler(
        new Euler(transform.rotation.x, transform.rotation.y, transform.rotation.z),
      ),
      new Vector3(transform.scale.x, transform.scale.y, transform.scale.z),
    )
    if (visiting.has(node.id)) return local
    visiting.add(node.id)
    const parent = node.parentId ? source.get(node.parentId) : undefined
    const world = parent ? matrixOf(parent).clone().multiply(local) : local
    visiting.delete(node.id)
    matrices.set(node.id, world)
    return world
  }
  return new Map(
    nodes.map(node => {
      const matrix = matrixOf(node)
      const position = new Vector3().setFromMatrixPosition(matrix)
      const scale = matrix.getMaxScaleOnAxis()
      return [
        node.id,
        {
          ...node,
          transform: {
            ...node.transform,
            position: { x: position.x, y: position.y, z: position.z },
            scale: { x: scale, y: scale, z: scale },
          },
        },
      ]
    }),
  )
}

export function artifactInputSignature(node: SceneNode): string {
  return stableKey([
    node.type,
    node.parentId,
    node.visible,
    node.castShadow,
    node.receiveShadow,
    node.components ?? null,
    node.optimization ?? null,
    node.transform,
    node.type === 'mesh' ? [node.geometry, node.material, node.negative] : null,
    node.type === 'model' ? node.model : null,
  ])
}

export function runtimeOptimizationOf(world: SceneState): RuntimeOptimization | null {
  if (!('runtimeOptimization' in world)) return null
  const optimization = world.runtimeOptimization
  return isRuntimeOptimization(optimization) ? optimization : null
}

function isRuntimeOptimization(value: unknown): value is RuntimeOptimization {
  if (!value || typeof value !== 'object' || !('artifacts' in value)) return false
  return Array.isArray(value.artifacts)
}

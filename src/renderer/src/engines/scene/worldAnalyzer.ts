import type {
  Mesh,
  BufferGeometry,
  Material,
  Object3D,
  Texture,
} from 'three'
import {
  classificationsOf,
  collectOwnMeshes,
  lossyCandidatesOf,
  spatialCellsOf,
  warningOf,
} from './worldAnalyzerSupport'
export { analyzeLossyWorld, analyzeModelOptimization, estimatedLossyImpact, lossyCandidatesOf } from './worldAnalyzerSupport'
import { byCodeUnit } from '@shared/text'
import { stableKey } from '@shared/hash'
import { behavioralGroupingExclusions, isDrawn, shapeAndPaint, withFlags } from './grouping'
import {
  EMPTY_STATS,
  geometryArraysOf,
  statsOf,
  textureBytesOf,
  texturesOf,
  type SceneStats,
} from './sceneStats'
import type { SceneNode, SceneState } from './sceneState'
import { batchKeyOf } from './batching'
import { bakeCandidatesOf, type BakeCandidate } from './bakeCandidates'
import { runtimeArtifactsOf } from './runtimeWorldCompiler'
import {
  GEOMETRY_CONTENT,
  MATERIAL_CONTENT,
  textureContent,
  type ResourceContent,
} from './resourceContent'

export type OptimizationClassification =
  | 'STATIC'
  | 'DYNAMIC'
  | 'SKINNED'
  | 'ANIMATED'
  | 'PARTICLE'
  | 'INSTANCABLE'
  | 'BATCHABLE'
  | 'MERGEABLE'
  | 'UNSAFE'

export type ClassifiedObject = {
  id: string
  classifications: readonly OptimizationClassification[]
}

export type InstanceCandidate = {
  key: string
  sourceIds: readonly string[]
  meshCount: number
}

export type BatchCandidate = InstanceCandidate
export type MergeCandidate = InstanceCandidate

export type GeometryDeduplication = {
  key: string
  sourceIds: readonly string[]
  bytes: number
}

export type MaterialDeduplication = {
  key: string
  sourceIds: readonly string[]
}

export type SpatialCellPlan = {
  key: string
  sourceIds: readonly string[]
}

export type OptimizationWarningReason = 'animated' | 'dynamic' | 'skinned'

/** Read by the dialog that names them and by the guard that checks each one is translated. */
export const OPTIMIZATION_WARNING_REASONS: readonly OptimizationWarningReason[] = [
  'animated',
  'dynamic',
  'skinned',
]

export type OptimizationWarning = {
  nodeId: string
  reason: OptimizationWarningReason
}

export type OptimizationMetrics = SceneStats & {
  objects: number
  visibleObjects: number
  meshes: number
  geometryBytes: number
  sharedMaterials: number
}

export type OptimizationImpact = {
  drawCallsBefore: number
  drawCallsAfter: number
  avoidedGeometryBytes: number
  avoidedTextureBytes: number
}

export type LossyCandidate = { nodeId: string }
export type TextureOptimizationCandidate = { assetId: string }
export type LossyWorldPlan = { nodeIds: readonly string[] }
export type ModelOptimizationCandidate = { meshIndex: number; geometry: BufferGeometry }

export type OptimizationPlan = {
  classifications: readonly ClassifiedObject[]
  instances: readonly InstanceCandidate[]
  bakeCandidates: readonly BakeCandidate[]
  batches: readonly BatchCandidate[]
  merges: readonly MergeCandidate[]
  sharedGeometry: readonly GeometryDeduplication[]
  sharedMaterials: readonly MaterialDeduplication[]
  spatialCells: readonly SpatialCellPlan[]
  lodCandidates?: readonly LossyCandidate[]
  textureCandidates?: readonly TextureOptimizationCandidate[]
  warnings: readonly OptimizationWarning[]
  measured: OptimizationMetrics
  estimated: OptimizationImpact
}

export type OptimizationReport = {
  measured: OptimizationMetrics
  estimated: OptimizationImpact
  instanceCandidates: number
  batchCandidates: number
  visualChanges: 'NONE'
}

export type LossyOptimizationImpact = {
  trianglesAfter: number
  geometryBytesAfter: number
  textureBytesAfter: number
}

import {
  DEFAULT_OPTIMIZATION_POLICY,
  type OptimizationPolicy,
} from '@shared/domain/optimizationPolicy'
export {
  DEFAULT_OPTIMIZATION_POLICY,
  type OptimizationPolicy,
} from '@shared/domain/optimizationPolicy'

export type AnalyzerPolicy = Pick<OptimizationPolicy, 'minInstancesPerGroup' | 'analysisChunkSize'> & {
  minBatchSize?: number
  maxSynchronousContentBytes?: number
}

type CandidateGroup = { ids: Set<string>; units: Set<string>; forced: boolean }
type ContentGroup<T> = {
  canonical: T
  key: string
  sourceIds: Set<string>
  uses: number
}

/**
 * What the authoring world would draw. A runtime group parks its sources on another layer but
 * leaves them visible, so the report can still measure the editable baseline.
 */
function isRendered(mesh: Object3D, host: Object3D): boolean {
  return isDrawn(mesh, host)
}

export function analyzeOptimization(
  state: Pick<SceneState, 'nodes' | 'animation'>,
  host: Object3D,
  objectOf: (id: string) => Object3D | undefined,
  policy: AnalyzerPolicy = DEFAULT_OPTIMIZATION_POLICY,
  runtimeNodes: readonly SceneNode[] = state.nodes,
): OptimizationPlan {
  return complete(optimizationSteps(state, host, objectOf, policy, runtimeNodes, true))
}

export async function analyzeOptimizationAsync(
  state: Pick<SceneState, 'nodes' | 'animation'>,
  host: Object3D,
  objectOf: (id: string) => Object3D | undefined,
  policy: AnalyzerPolicy = DEFAULT_OPTIMIZATION_POLICY,
  runtimeNodes: readonly SceneNode[] = state.nodes,
  pause: () => Promise<void> = nextTask,
): Promise<OptimizationPlan> {
  const steps = optimizationSteps(state, host, objectOf, policy, runtimeNodes, false)
  let worked = 0
  while (true) {
    const step = steps.next()
    if (step.done) return step.value
    worked += 1
    if (worked >= policy.analysisChunkSize) {
      worked = 0
      await pause()
    }
  }
}

function complete(steps: Generator<void, OptimizationPlan>): OptimizationPlan {
  while (true) {
    const step = steps.next()
    if (step.done) return step.value
  }
}

function* optimizationSteps(
  state: Pick<SceneState, 'nodes' | 'animation'>,
  host: Object3D,
  objectOf: (id: string) => Object3D | undefined,
  policy: AnalyzerPolicy,
  runtimeNodes: readonly SceneNode[],
  includeBakeCandidates: boolean,
): Generator<void, OptimizationPlan> {
  const analysis = createAnalysis(state, runtimeNodes, policy)
  yield* collectAnalysis(state.nodes, host, objectOf, analysis)
  return optimizationPlan(state, runtimeNodes, objectOf, policy, includeBakeCandidates, analysis)
}

function createAnalysis(state: Pick<SceneState, 'nodes' | 'animation'>,
  runtimeNodes: readonly SceneNode[], policy: AnalyzerPolicy) {
  const animated = new Set(state.animation.tracks.map(track => track.target.nodeId))
  const maxContentBytes =
    policy.maxSynchronousContentBytes ?? DEFAULT_OPTIMIZATION_POLICY.maxSynchronousContentBytes
  const excluded = behavioralGroupingExclusions(runtimeNodes, animated)
  return {
    animated, maxContentBytes, excluded, drawn: new Set<Mesh>(),
    seenStats: { geometries: new Set<unknown>(), textures: new Set<unknown>() },
    sceneStats: { ...EMPTY_STATS }, geometryArrays: new Set<ArrayBufferView>(),
    geometryGroups: new Map<string, ContentGroup<BufferGeometry>[]>(),
    identityGeometryGroups: new WeakMap<BufferGeometry, ContentGroup<BufferGeometry>>(),
    largeGeometryGroups: emptyList<ContentGroup<BufferGeometry>>(),
    materialGroups: new Map<string, ContentGroup<Material>[]>(),
    textureGroups: new Map<string, ContentGroup<Texture>[]>(),
    geometryKeys: new WeakMap<BufferGeometry, string>(), materialKeys: new WeakMap<Material, string>(),
    textureKeys: new WeakMap<Texture, string>(), opaqueTextureUses: new Map<Texture, number>(),
    geometryBytes: 0, avoidedGeometryBytes: 0, avoidedTextureBytes: 0, sharedMaterialUses: 0,
    candidateGroups: new Map<string, CandidateGroup>(), batchGroups: new Map<string, CandidateGroup>(),
    keyOf: withFlags(shapeAndPaint()), batchKey: batchKeyOf(),
    classifications: emptyList<ClassifiedObject>(), warnings: emptyList<OptimizationWarning>(), visibleObjects: 0,
  }
}

function emptyList<T>(): T[] {
  return []
}

type Analysis = ReturnType<typeof createAnalysis>

function* collectAnalysis(nodes: readonly SceneNode[], host: Object3D,
  objectOf: (id: string) => Object3D | undefined, analysis: Analysis): Generator<void> {
  for (const node of nodes) {
    const object = objectOf(node.id)
    const own: Mesh[] = []
    if (object) yield* collectOwnMeshes(node, object, own)
    const shown = object && isDrawn(object, host) ? own.filter(mesh => isRendered(mesh, host)) : []
    if (shown.length > 0) analysis.visibleObjects += 1
    for (const mesh of shown) {
      collectMesh(node.id, mesh, analysis)
      yield
    }
    const nodeClassifications = classificationsOf(node, object, analysis.animated.has(node.id), own)
    analysis.classifications.push({ id: node.id, classifications: nodeClassifications })
    const reason = warningOf(nodeClassifications)
    if (reason) analysis.warnings.push({ nodeId: node.id, reason })
    if (!nodeClassifications.includes('INSTANCABLE')) {
      yield
      continue
    }
    for (const [meshIndex, mesh] of shown.entries()) {
      if (Array.isArray(mesh.material)) continue
      const unit = stableKey([node.id, meshIndex])
      if (!analysis.excluded.has(node.id)) collectNodeCandidates(node, mesh, unit, analysis)
      yield
    }
  }
}

function collectMesh(nodeId: string, mesh: Mesh, analysis: Analysis): void {
  analysis.drawn.add(mesh)
  const added = statsOf([mesh], analysis.seenStats)
  analysis.sceneStats.triangles += added.triangles
  analysis.sceneStats.vertices += added.vertices
  analysis.sceneStats.draws += added.draws
  analysis.sceneStats.textureBytes += added.textureBytes
  collectGeometry(nodeId, mesh.geometry, analysis)
  const worn = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  for (const material of worn) collectMaterial(nodeId, material, analysis)
}

function collectGeometry(nodeId: string, geometry: BufferGeometry, analysis: Analysis): void {
  const group = geometryByteLength(geometry) <= analysis.maxContentBytes
    ? collectContent(analysis.geometryGroups, analysis.geometryKeys, geometry, nodeId, GEOMETRY_CONTENT)
    : collectIdentity(analysis.identityGeometryGroups, analysis.largeGeometryGroups, geometry, nodeId, 'geometry')
  if (group.uses > 1) analysis.avoidedGeometryBytes += geometryByteLength(geometry)
  for (const array of geometryArraysOf(geometry)) {
    if (analysis.geometryArrays.has(array)) continue
    analysis.geometryArrays.add(array)
    analysis.geometryBytes += array.byteLength
  }
}

function collectMaterial(nodeId: string, material: Material, analysis: Analysis): void {
  if (collectContent(analysis.materialGroups, analysis.materialKeys, material, nodeId, MATERIAL_CONTENT).uses > 1) {
    analysis.sharedMaterialUses += 1
  }
  for (const texture of texturesOf(material)) {
    const content = textureContent(texture, analysis.maxContentBytes)
    const uses = content
      ? collectContent(analysis.textureGroups, analysis.textureKeys, texture, nodeId, content).uses
      : countIdentity(analysis.opaqueTextureUses, texture)
    if (uses > 1) analysis.avoidedTextureBytes += textureBytesOf(texture)
  }
}

function collectNodeCandidates(node: SceneNode, mesh: Mesh, unit: string, analysis: Analysis): void {
  collectCandidate(analysis.candidateGroups, analysis.keyOf(node, mesh), node, unit, 'instance')
  collectCandidate(analysis.batchGroups, analysis.batchKey(node, mesh), node, unit, 'batch')
}

function instanceCandidates(analysis: Analysis, policy: AnalyzerPolicy): InstanceCandidate[] {
  return [...analysis.candidateGroups].map(([key, group]) => ({
    key, sourceIds: [...group.ids].sort(byCodeUnit), meshCount: group.units.size,
    units: group.units, forced: group.forced,
  })).filter(group => group.forced || group.meshCount >= policy.minInstancesPerGroup)
    .map(group => ({ key: group.key, sourceIds: group.sourceIds, meshCount: group.meshCount }))
    .sort((one, other) => byCodeUnit(one.key, other.key))
}

function groupedCandidates(state: Pick<SceneState, 'nodes' | 'animation'>,
  runtimeNodes: readonly SceneNode[], policy: AnalyzerPolicy, analysis: Analysis) {
  const runtimeArtifacts = runtimeArtifactsOf(runtimeNodes, state.animation, { ...DEFAULT_OPTIMIZATION_POLICY, ...policy })
  const forcedIds = new Set(state.nodes.flatMap(node => node.optimization?.mode === 'batch' ? [node.id] : []))
  const candidatesFor = (strategy: 'batch' | 'merge') => runtimeArtifacts.filter(a => a.strategy === strategy)
    .map(a => ({ key: a.key, sourceIds: a.sourceIds, meshCount: a.sourceIds.length }))
    .sort((a, b) => byCodeUnit(a.key, b.key))
  const automatic = candidatesFor('batch').filter(group => group.sourceIds.every(id => !forcedIds.has(id)))
  const forced = [...analysis.batchGroups].filter(([, group]) => group.forced).map(([key, group]) => ({
    key, sourceIds: [...group.ids].sort(byCodeUnit), meshCount: group.units.size,
  }))
  return { batches: [...forced, ...automatic].sort((a, b) => byCodeUnit(a.key, b.key)), merges: candidatesFor('merge') }
}

function sharedResources(analysis: Analysis) {
  const sharedGeometry = [...[...analysis.geometryGroups.values()].flat(), ...analysis.largeGeometryGroups]
    .filter(group => group.uses > 1).map(group => ({ key: group.key,
      sourceIds: [...group.sourceIds].sort(byCodeUnit), bytes: geometryByteLength(group.canonical) }))
    .sort((a, b) => byCodeUnit(a.key, b.key))
  const sharedMaterials = [...analysis.materialGroups.values()].flat().filter(group => group.uses > 1)
    .map(group => ({ key: group.key, sourceIds: [...group.sourceIds].sort(byCodeUnit) }))
    .sort((a, b) => byCodeUnit(a.key, b.key))
  return { sharedGeometry, sharedMaterials }
}

function optimizationPlan(state: Pick<SceneState, 'nodes' | 'animation'>,
  runtimeNodes: readonly SceneNode[], objectOf: (id: string) => Object3D | undefined,
  policy: AnalyzerPolicy, includeBakeCandidates: boolean, analysis: Analysis): OptimizationPlan {
  const instances = instanceCandidates(analysis, policy)
  const { batches, merges } = groupedCandidates(state, runtimeNodes, policy, analysis)
  const instanceSavings = instances.reduce((saved, group) => saved + group.meshCount - 1, 0)
  const groupedSavings = [...batches, ...merges].reduce((saved, group) => saved + Math.max(0, group.meshCount - 1), 0)
  const shared = sharedResources(analysis)
  return {
    classifications: analysis.classifications, instances,
    bakeCandidates: includeBakeCandidates ? bakeCandidatesOf(state.nodes, runtimeNodes, analysis.animated) : [],
    batches, merges, ...shared, spatialCells: spatialCellsOf(state.nodes, objectOf, policy),
    ...lossyCandidatesOf(state.nodes), warnings: analysis.warnings,
    measured: { ...analysis.sceneStats, objects: state.nodes.length, visibleObjects: analysis.visibleObjects,
      meshes: analysis.drawn.size, geometryBytes: analysis.geometryBytes, sharedMaterials: analysis.sharedMaterialUses },
    estimated: { drawCallsBefore: analysis.sceneStats.draws,
      drawCallsAfter: Math.max(0, analysis.sceneStats.draws - instanceSavings - groupedSavings),
      avoidedGeometryBytes: analysis.avoidedGeometryBytes, avoidedTextureBytes: analysis.avoidedTextureBytes },
  }
}

function collectContent<T extends object>(
  groups: Map<string, ContentGroup<T>[]>,
  keys: WeakMap<T, string>,
  resource: T,
  nodeId: string,
  content: ResourceContent<T>,
): ContentGroup<T> {
  const held = keys.get(resource)
  const key = held ?? content.key(resource)
  if (held === undefined) keys.set(resource, key)
  const bucket = groups.get(key) ?? []
  let group = bucket.find(
    candidate => candidate.canonical === resource || content.equals(candidate.canonical, resource),
  )
  if (!group) {
    group = { canonical: resource, key: `${key}:${bucket.length}`, sourceIds: new Set(), uses: 0 }
    bucket.push(group)
    groups.set(key, bucket)
  }
  group.sourceIds.add(nodeId)
  group.uses += 1
  return group
}

function collectIdentity<T extends object>(
  groups: WeakMap<T, ContentGroup<T>>,
  list: ContentGroup<T>[],
  resource: T,
  nodeId: string,
  kind: string,
): ContentGroup<T> {
  let group = groups.get(resource)
  if (!group) {
    group = {
      canonical: resource,
      key: stableKey([kind, list.length]),
      sourceIds: new Set(),
      uses: 0,
    }
    groups.set(resource, group)
    list.push(group)
  }
  group.sourceIds.add(nodeId)
  group.uses += 1
  return group
}

function countIdentity<T>(uses: Map<T, number>, resource: T): number {
  const count = (uses.get(resource) ?? 0) + 1
  uses.set(resource, count)
  return count
}


function nextTask(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0))
}

function collectCandidate(
  groups: Map<string, CandidateGroup>,
  key: string,
  node: SceneNode,
  unit: string,
  forcedMode: 'instance' | 'batch',
): void {
  const group = groups.get(key)
  if (group) {
    group.ids.add(node.id)
    group.units.add(unit)
    group.forced ||= node.optimization?.mode === forcedMode
    return
  }
  groups.set(key, {
    ids: new Set([node.id]),
    units: new Set([unit]),
    forced: node.optimization?.mode === forcedMode,
  })
}

export function optimizationReport(plan: OptimizationPlan): OptimizationReport {
  return {
    measured: plan.measured,
    estimated: plan.estimated,
    instanceCandidates: plan.instances.reduce((count, group) => count + group.meshCount, 0),
    batchCandidates: plan.batches.reduce((count, group) => count + group.meshCount, 0),
    visualChanges: 'NONE',
  }
}



function geometryByteLength(geometry: BufferGeometry): number {
  return geometryArraysOf(geometry).reduce((bytes, array) => bytes + array.byteLength, 0)
}

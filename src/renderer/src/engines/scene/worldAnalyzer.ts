import {
  LOD,
  Mesh,
  PropertyBinding,
  SkinnedMesh,
  Vector3,
  type BufferGeometry,
  type Material,
  type Object3D,
  type Texture,
} from 'three'
import { movesOnItsOwn } from '@shared/domain/component'
import { byCodeUnit } from '@shared/text'
import { stableKey } from '@shared/hash'
import { behavioralGroupingExclusions, isDrawn, shapeAndPaint, withFlags } from './grouping'
import { isInstanceable } from './instanceableModel'
import {
  EMPTY_STATS,
  geometryArraysOf,
  statsOf,
  textureBytesOf,
  texturesOf,
  type SceneStats,
} from './sceneStats'
import type { SceneNode, SceneState } from './sceneState'
import type { LossyOptimization } from '@shared/domain/gameExport'
import { batchKeyOf } from './batching'
import { bakeCandidatesOf, type BakeCandidate } from './bakeCandidates'
import { runtimeArtifactsOf } from './runtimeWorldCompiler'
import { adaptiveCellsOf } from './adaptivePartition'
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

type AnalyzerPolicy = Pick<OptimizationPolicy, 'minInstancesPerGroup' | 'analysisChunkSize'> & {
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
  const animated = new Set(state.animation.tracks.map(track => track.target.nodeId))
  const maxContentBytes =
    policy.maxSynchronousContentBytes ?? DEFAULT_OPTIMIZATION_POLICY.maxSynchronousContentBytes
  const excluded = behavioralGroupingExclusions(runtimeNodes, animated)
  // Enumerated ONCE per node: read again for the classification and again for the grouping, a
  // model of P primitives paid three full `traverse` walks for one pass.
  const drawn = new Set<Mesh>()
  const seenStats = { geometries: new Set<unknown>(), textures: new Set<unknown>() }
  const sceneStats = { ...EMPTY_STATS }
  const geometryArrays = new Set<ArrayBufferView>()
  const geometryGroups = new Map<string, ContentGroup<BufferGeometry>[]>()
  const identityGeometryGroups = new WeakMap<BufferGeometry, ContentGroup<BufferGeometry>>()
  const largeGeometryGroups: ContentGroup<BufferGeometry>[] = []
  const materialGroups = new Map<string, ContentGroup<Material>[]>()
  const textureGroups = new Map<string, ContentGroup<Texture>[]>()
  const geometryKeys = new WeakMap<BufferGeometry, string>()
  const materialKeys = new WeakMap<Material, string>()
  const textureKeys = new WeakMap<Texture, string>()
  const opaqueTextureUses = new Map<Texture, number>()
  let geometryBytes = 0
  let avoidedGeometryBytes = 0
  let avoidedTextureBytes = 0
  let sharedMaterialUses = 0
  const candidateGroups = new Map<string, CandidateGroup>()
  const batchGroups = new Map<string, CandidateGroup>()
  const keyOf = withFlags(shapeAndPaint())
  const batchKey = batchKeyOf()
  const classifications: ClassifiedObject[] = []
  const warnings: OptimizationWarning[] = []
  let visibleObjects = 0

  for (const node of state.nodes) {
    const object = objectOf(node.id)
    const own: Mesh[] = []
    if (object) yield* collectOwnMeshes(node, object, own)
    const shown = object && isDrawn(object, host) ? own.filter(mesh => isRendered(mesh, host)) : []
    if (shown.length > 0) visibleObjects += 1
    for (const mesh of shown) {
      drawn.add(mesh)
      const added = statsOf([mesh], seenStats)
      sceneStats.triangles += added.triangles
      sceneStats.vertices += added.vertices
      sceneStats.draws += added.draws
      sceneStats.textureBytes += added.textureBytes

      const geometryGroup =
        geometryByteLength(mesh.geometry) <= maxContentBytes
          ? collectContent(geometryGroups, geometryKeys, mesh.geometry, node.id, GEOMETRY_CONTENT)
          : collectIdentity(
              identityGeometryGroups,
              largeGeometryGroups,
              mesh.geometry,
              node.id,
              'geometry',
            )
      if (geometryGroup.uses > 1) {
        avoidedGeometryBytes += geometryByteLength(mesh.geometry)
      }
      for (const array of geometryArraysOf(mesh.geometry)) {
        if (geometryArrays.has(array)) continue
        geometryArrays.add(array)
        geometryBytes += array.byteLength
      }
      const worn = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const material of worn) {
        if (
          collectContent(materialGroups, materialKeys, material, node.id, MATERIAL_CONTENT).uses > 1
        ) {
          sharedMaterialUses += 1
        }
        for (const texture of texturesOf(material)) {
          const content = textureContent(texture, maxContentBytes)
          const uses = content
            ? collectContent(textureGroups, textureKeys, texture, node.id, content).uses
            : countIdentity(opaqueTextureUses, texture)
          if (uses > 1) avoidedTextureBytes += textureBytesOf(texture)
        }
      }
      yield
    }

    const nodeClassifications = classificationsOf(node, object, animated.has(node.id), own)
    classifications.push({ id: node.id, classifications: nodeClassifications })

    const reason = warningOf(nodeClassifications)
    if (reason) warnings.push({ nodeId: node.id, reason })
    if (!nodeClassifications.includes('INSTANCABLE')) {
      yield
      continue
    }

    for (const [meshIndex, mesh] of shown.entries()) {
      if (Array.isArray(mesh.material)) continue
      const unit = stableKey([node.id, meshIndex])
      if (!excluded.has(node.id)) {
        collectCandidate(candidateGroups, keyOf(node, mesh), node, unit, 'instance')
      }
      if (!excluded.has(node.id)) {
        collectCandidate(batchGroups, batchKey(node, mesh), node, unit, 'batch')
      }
      yield
    }
  }

  const allInstanceCandidates = [...candidateGroups].map(([key, group]) => ({
    key,
    sourceIds: [...group.ids].sort(byCodeUnit),
    meshCount: group.units.size,
    units: group.units,
    forced: group.forced,
  }))
  const instances = allInstanceCandidates
    .filter(group => group.forced || group.meshCount >= policy.minInstancesPerGroup)
    .map(group => ({ key: group.key, sourceIds: group.sourceIds, meshCount: group.meshCount }))
    .sort((one, other) => byCodeUnit(one.key, other.key))
  const bakeCandidates = includeBakeCandidates
    ? bakeCandidatesOf(state.nodes, runtimeNodes, animated)
    : []
  const runtimeArtifacts = runtimeArtifactsOf(runtimeNodes, state.animation, {
    ...DEFAULT_OPTIMIZATION_POLICY,
    ...policy,
  })
  const forcedBatchIds = new Set(
    state.nodes.flatMap(node => (node.optimization?.mode === 'batch' ? [node.id] : [])),
  )
  const candidatesFor = (strategy: 'batch' | 'merge'): readonly InstanceCandidate[] =>
    runtimeArtifacts
      .filter(artifact => artifact.strategy === strategy)
      .map(artifact => ({
        key: artifact.key,
        sourceIds: artifact.sourceIds,
        meshCount: artifact.sourceIds.length,
      }))
      .sort((one, other) => byCodeUnit(one.key, other.key))
  const automaticBatches = candidatesFor('batch').filter(group =>
    group.sourceIds.every(id => !forcedBatchIds.has(id)),
  )
  const forcedBatches = [...batchGroups]
    .filter(([, group]) => group.forced)
    .map(([key, group]) => ({
      key,
      sourceIds: [...group.ids].sort(byCodeUnit),
      meshCount: group.units.size,
    }))
  const batches = [...forcedBatches, ...automaticBatches].sort((one, other) =>
    byCodeUnit(one.key, other.key),
  )
  const merges = candidatesFor('merge')
  const instanceSavings = instances.reduce((saved, group) => saved + group.meshCount - 1, 0)
  const groupedSavings = [...batches, ...merges].reduce(
    (saved, group) => saved + Math.max(0, group.meshCount - 1),
    0,
  )
  const sharedGeometry = [...[...geometryGroups.values()].flat(), ...largeGeometryGroups]
    .filter(group => group.uses > 1)
    .map(group => ({
      key: group.key,
      sourceIds: [...group.sourceIds].sort(byCodeUnit),
      bytes: geometryByteLength(group.canonical),
    }))
    .sort((one, other) => byCodeUnit(one.key, other.key))
  const sharedMaterials = [...materialGroups.values()]
    .flat()
    .filter(group => group.uses > 1)
    .map(group => ({
      key: group.key,
      sourceIds: [...group.sourceIds].sort(byCodeUnit),
    }))
    .sort((one, other) => byCodeUnit(one.key, other.key))
  const spatialCells = spatialCellsOf(state.nodes, objectOf, policy)

  return {
    classifications,
    instances,
    bakeCandidates,
    batches,
    merges,
    sharedGeometry,
    sharedMaterials,
    spatialCells,
    ...lossyCandidatesOf(state.nodes),
    warnings,
    measured: {
      ...sceneStats,
      objects: state.nodes.length,
      visibleObjects,
      meshes: drawn.size,
      geometryBytes,
      sharedMaterials: sharedMaterialUses,
    },
    estimated: {
      drawCallsBefore: sceneStats.draws,
      drawCallsAfter: Math.max(0, sceneStats.draws - instanceSavings - groupedSavings),
      avoidedGeometryBytes,
      avoidedTextureBytes,
    },
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

function spatialCellsOf(
  nodes: readonly SceneNode[],
  objectOf: (id: string) => Object3D | undefined,
  policy: AnalyzerPolicy,
): readonly SpatialCellPlan[] {
  const position = new Vector3()
  const scale = new Vector3()
  const meshes = nodes.flatMap(node => {
    if (node.type !== 'mesh') return []
    const object = objectOf(node.id)
    if (!object) return [node]
    object.getWorldPosition(position)
    object.getWorldScale(scale)
    return [
      {
        ...node,
        transform: {
          ...node.transform,
          position: { x: position.x, y: position.y, z: position.z },
          scale: { x: scale.x, y: scale.y, z: scale.z },
        },
      },
    ]
  })
  const resolved = { ...DEFAULT_OPTIMIZATION_POLICY, ...policy }
  const cells = new Map<string, string[]>()
  for (const { cell, nodes: members } of adaptiveCellsOf(meshes, resolved)) {
    const key = stableKey([cell.size, cell.x, cell.y, cell.z])
    cells.set(
      key,
      members.map(node => node.id),
    )
  }
  const fallbackSize = Math.max(
    1,
    Math.min(resolved.maxBatchBounds / 4, resolved.spatialCellTargetSize),
  )
  for (const node of nodes) {
    if (node.type === 'mesh') continue
    const object = objectOf(node.id)
    if (object) object.getWorldPosition(position)
    else
      position.set(node.transform.position.x, node.transform.position.y, node.transform.position.z)
    const key = stableKey([
      fallbackSize,
      Math.floor(position.x / fallbackSize),
      Math.floor(position.y / fallbackSize),
      Math.floor(position.z / fallbackSize),
    ])
    const sourceIds = cells.get(key)
    if (sourceIds) sourceIds.push(node.id)
    else cells.set(key, [node.id])
  }
  return [...cells]
    .map(([key, sourceIds]) => ({ key, sourceIds: sourceIds.sort(byCodeUnit) }))
    .sort((one, other) => byCodeUnit(one.key, other.key))
}

export function lossyCandidatesOf(
  nodes: readonly SceneNode[],
): Pick<Required<OptimizationPlan>, 'lodCandidates' | 'textureCandidates'> {
  const lodCandidates = nodes
    .filter(
      node =>
        node.optimization?.mode !== 'exclude' &&
        (node.type === 'mesh' || node.type === 'carved' || node.type === 'model'),
    )
    .map(node => ({ nodeId: node.id }))
    .sort((one, other) => byCodeUnit(one.nodeId, other.nodeId))
  const textures = new Set<string>()
  const protectedTextures = new Set<string>()
  for (const node of nodes) {
    if (node.type !== 'mesh' && node.type !== 'carved') continue
    const assetId = node.material.map?.assetId
    if (!assetId) continue
    ;(node.optimization?.mode === 'exclude' ? protectedTextures : textures).add(assetId)
  }
  for (const assetId of protectedTextures) textures.delete(assetId)
  return {
    lodCandidates,
    textureCandidates: [...textures].sort(byCodeUnit).map(assetId => ({ assetId })),
  }
}

export function analyzeLossyWorld(nodes: readonly SceneNode[]): LossyWorldPlan {
  return { nodeIds: lossyCandidatesOf(nodes).lodCandidates.map(candidate => candidate.nodeId) }
}

export function analyzeModelOptimization(
  root: Object3D,
  generateLods: boolean,
): readonly ModelOptimizationCandidate[] {
  const animated = animatedModelNodeNames(root)
  const candidates: ModelOptimizationCandidate[] = []
  let meshIndex = 0
  root.traverse(object => {
    if (!(object instanceof Mesh)) return
    const index = meshIndex
    meshIndex += 1
    const attributes = Object.keys(object.geometry.attributes)
    const color = object.geometry.getAttribute('color')
    if (
      !(object instanceof SkinnedMesh) &&
      !animated.has(object.name) &&
      (!generateLods || !hasLodAncestor(object)) &&
      Object.keys(object.geometry.morphAttributes).length === 0 &&
      !Array.isArray(object.material) &&
      attributes.every(attribute => SIMPLIFIED_MODEL_ATTRIBUTES.has(attribute)) &&
      (!color || color.itemSize === 3) &&
      object.geometry.drawRange.start === 0 &&
      object.geometry.drawRange.count === Infinity &&
      object.geometry.getAttribute('position')?.count > 3
    ) {
      candidates.push({ meshIndex: index, geometry: object.geometry })
    }
  })
  return candidates
}

const SIMPLIFIED_MODEL_ATTRIBUTES = new Set(['position', 'normal', 'uv', 'tangent', 'color'])

function hasLodAncestor(mesh: Mesh): boolean {
  let parent = mesh.parent
  while (parent) {
    if (parent instanceof LOD) return true
    parent = parent.parent
  }
  return false
}

function animatedModelNodeNames(root: Object3D): ReadonlySet<string> {
  const names = new Set<string>()
  for (const clip of root.animations) {
    for (const track of clip.tracks) {
      try {
        names.add(PropertyBinding.parseTrackName(track.name).nodeName)
      } catch {
        const all = new Set<string>()
        root.traverse(object => all.add(object.name))
        return all
      }
    }
  }
  return names
}

function nextTask(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0))
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

export function estimatedLossyImpact(
  plan: OptimizationPlan,
  options: LossyOptimization,
  policy: OptimizationPolicy = DEFAULT_OPTIMIZATION_POLICY,
): LossyOptimizationImpact {
  const geometryRatio = policy.simplificationRatios[options.geometrySimplification]
  const textureScale = policy.textureScale[options.textureReduction]
  const textureQuality =
    options.textureCompression === 'off' ? 1 : policy.jpegQuality[options.textureCompression] / 100
  return {
    trianglesAfter: Math.round(plan.measured.triangles * (1 - geometryRatio)),
    geometryBytesAfter: Math.round(plan.measured.geometryBytes * (1 - geometryRatio)),
    textureBytesAfter: Math.round(
      plan.measured.textureBytes * textureScale * textureScale * textureQuality,
    ),
  }
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
  } else {
    groups.set(key, {
      ids: new Set([node.id]),
      units: new Set([unit]),
      forced: node.optimization?.mode === forcedMode,
    })
  }
}

function classificationsOf(
  node: SceneNode,
  object: Object3D | undefined,
  animated: boolean,
  meshes: readonly Mesh[],
): OptimizationClassification[] {
  const classifications: OptimizationClassification[] = []
  const skinned = meshes.some(mesh => mesh instanceof SkinnedMesh)
  const dynamic =
    movesOnItsOwn(node.components) ||
    node.components?.some(component => component.type === 'Script')
  const instancable =
    !animated &&
    !dynamic &&
    !skinned &&
    object !== undefined &&
    ((node.type === 'mesh' && object instanceof Mesh && !(object instanceof SkinnedMesh)) ||
      (node.type === 'model' && isInstanceable(object)))

  if (!animated && !dynamic && !skinned) classifications.push('STATIC')
  if (dynamic) classifications.push('DYNAMIC')
  if (skinned) classifications.push('SKINNED')
  if (animated) classifications.push('ANIMATED')
  if (instancable) classifications.push('INSTANCABLE')
  if (instancable) classifications.push('BATCHABLE')
  if (instancable && !node.components?.length && node.parentId === null)
    classifications.push('MERGEABLE')
  if (animated || dynamic || skinned) classifications.push('UNSAFE')
  return classifications
}

function warningOf(
  classifications: readonly OptimizationClassification[],
): OptimizationWarning['reason'] | null {
  if (classifications.includes('SKINNED')) return 'skinned'
  if (classifications.includes('ANIMATED')) return 'animated'
  if (classifications.includes('DYNAMIC')) return 'dynamic'
  return null
}

function* collectOwnMeshes(node: SceneNode, object: Object3D, meshes: Mesh[]): Generator<void> {
  if (node.type === 'mesh') {
    if (object instanceof Mesh) meshes.push(object)
    yield
    return
  }
  if (node.type !== 'model') return

  const pending = [object]
  while (pending.length > 0) {
    const child = pending.pop()
    if (!child) continue
    if (child instanceof Mesh) meshes.push(child)
    for (let index = child.children.length - 1; index >= 0; index -= 1) {
      const descendant = child.children[index]
      if (descendant) pending.push(descendant)
    }
    yield
  }
}

function geometryByteLength(geometry: BufferGeometry): number {
  return geometryArraysOf(geometry).reduce((bytes, array) => bytes + array.byteLength, 0)
}

import { Mesh, SkinnedMesh, type BufferGeometry, type Material, type Object3D } from 'three'
import { movesOnItsOwn } from '@shared/domain/component'
import { byCodeUnit } from '@shared/text'
import { WORTH_INSTANCING, flagsOf, shapeAndPaint } from './grouping'
import { isInstanceable, meshesOf } from './instanceableModel'
import { statsOf, type SceneStats } from './sceneStats'
import type { SceneNode, SceneState } from './sceneState'

export type OptimizationClassification =
  | 'STATIC'
  | 'DYNAMIC'
  | 'SKINNED'
  | 'ANIMATED'
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

export type OptimizationWarning = {
  nodeId: string
  reason: 'animated' | 'dynamic' | 'skinned'
}

export type OptimizationMetrics = SceneStats & {
  objects: number
  meshes: number
  geometryBytes: number
}

export type OptimizationImpact = {
  drawCallsBefore: number
  drawCallsAfter: number
}

export type OptimizationPlan = {
  classifications: readonly ClassifiedObject[]
  instances: readonly InstanceCandidate[]
  warnings: readonly OptimizationWarning[]
  measured: OptimizationMetrics
  estimated: OptimizationImpact
}

export type OptimizationReport = {
  measured: OptimizationMetrics
  estimated: OptimizationImpact
  instanceCandidates: number
  visualChanges: 'NONE'
}

export type OptimizationPolicy = {
  minInstancesPerGroup: number
}

export const DEFAULT_OPTIMIZATION_POLICY: OptimizationPolicy = {
  minInstancesPerGroup: WORTH_INSTANCING,
}

type CandidateGroup = { ids: Set<string>; meshes: number }

export function analyzeOptimization(
  state: Pick<SceneState, 'nodes' | 'animation'>,
  objectOf: (id: string) => Object3D | undefined,
  policy: OptimizationPolicy = DEFAULT_OPTIMIZATION_POLICY,
): OptimizationPlan {
  const animated = new Set(state.animation.tracks.map(track => track.target.nodeId))
  const objects = state.nodes.flatMap(node => objectOf(node.id) ?? [])
  const candidateGroups = new Map<string, CandidateGroup>()
  const keyOf = shapeAndPaint()
  const classifications: ClassifiedObject[] = []
  const warnings: OptimizationWarning[] = []

  for (const node of state.nodes) {
    const object = objectOf(node.id)
    const nodeClassifications = classificationsOf(node, object, animated.has(node.id))
    classifications.push({ id: node.id, classifications: nodeClassifications })

    const reason = warningOf(nodeClassifications)
    if (reason) warnings.push({ nodeId: node.id, reason })
    if (!nodeClassifications.includes('INSTANCABLE') || !object) continue

    for (const mesh of drawableMeshes(node, object)) {
      if (Array.isArray(mesh.material)) continue
      const key = `${keyOf(node, mesh)}|${flagsOf(node, mesh)}`
      const group = candidateGroups.get(key)
      if (group) {
        group.ids.add(node.id)
        group.meshes += 1
      } else candidateGroups.set(key, { ids: new Set([node.id]), meshes: 1 })
    }
  }

  const instances = [...candidateGroups]
    .filter(([, group]) => group.meshes >= policy.minInstancesPerGroup)
    .map(([key, group]) => ({ key, sourceIds: [...group.ids].sort(), meshCount: group.meshes }))
    .sort((one, other) => byCodeUnit(one.key, other.key))
  const sceneStats = statsOf(objects)
  const savedDraws = instances.reduce((saved, group) => saved + group.meshCount - 1, 0)

  return {
    classifications,
    instances,
    warnings,
    measured: {
      ...sceneStats,
      objects: state.nodes.length,
      meshes: objects.reduce((count, object) => count + visibleMeshesOf(object).length, 0),
      geometryBytes: geometryBytesOf(objects),
    },
    estimated: {
      drawCallsBefore: sceneStats.draws,
      drawCallsAfter: Math.max(0, sceneStats.draws - savedDraws),
    },
  }
}

export function optimizationReport(plan: OptimizationPlan): OptimizationReport {
  return {
    measured: plan.measured,
    estimated: plan.estimated,
    instanceCandidates: plan.instances.reduce((count, group) => count + group.meshCount, 0),
    visualChanges: 'NONE',
  }
}

function classificationsOf(
  node: SceneNode,
  object: Object3D | undefined,
  animated: boolean,
): OptimizationClassification[] {
  const classifications: OptimizationClassification[] = []
  const meshes = object ? visibleMeshesOf(object) : []
  const skinned = meshes.some(mesh => mesh instanceof SkinnedMesh)
  const dynamic = movesOnItsOwn(node.components)
  const instancable =
    !animated &&
    !dynamic &&
    !skinned &&
    object !== undefined &&
    ((node.type === 'mesh' && object instanceof Mesh) ||
      (node.type === 'model' && isInstanceable(object)))

  if (!animated && !dynamic && !skinned) classifications.push('STATIC')
  if (dynamic) classifications.push('DYNAMIC')
  if (skinned) classifications.push('SKINNED')
  if (animated) classifications.push('ANIMATED')
  if (instancable) classifications.push('INSTANCABLE')
  if (!animated && !dynamic && !skinned && meshes.some(hasSingleMaterial)) {
    classifications.push('BATCHABLE')
    if (node.components === undefined || node.components.length === 0) {
      classifications.push('MERGEABLE')
    }
  }
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

function drawableMeshes(node: SceneNode, object: Object3D): Mesh[] {
  if (node.type === 'mesh') return object instanceof Mesh && object.visible ? [object] : []
  return meshesOf(object).filter(mesh => mesh.visible)
}

function visibleMeshesOf(object: Object3D): Mesh[] {
  const meshes: Mesh[] = []
  object.traverse(child => {
    if (child instanceof Mesh && child.visible) meshes.push(child)
  })
  return meshes
}

function hasSingleMaterial(mesh: Mesh): boolean {
  return !Array.isArray(mesh.material)
}

function geometryBytesOf(objects: readonly Object3D[]): number {
  const geometries = new Set<BufferGeometry>()
  const buffers = new Set<ArrayBufferLike>()
  for (const object of objects) {
    for (const mesh of visibleMeshesOf(object)) geometries.add(mesh.geometry)
  }
  for (const geometry of geometries) {
    if (geometry.index) buffers.add(geometry.index.array.buffer)
    for (const attribute of Object.values(geometry.attributes)) buffers.add(attribute.array.buffer)
  }
  return [...buffers].reduce((bytes, buffer) => bytes + buffer.byteLength, 0)
}

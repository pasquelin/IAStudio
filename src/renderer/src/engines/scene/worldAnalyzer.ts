import { Mesh, SkinnedMesh, type BufferGeometry, type Object3D } from 'three'
import { movesOnItsOwn } from '@shared/domain/component'
import { byCodeUnit } from '@shared/text'
import { WORTH_INSTANCING, flagsOf, isDrawn, shapeAndPaint } from './grouping'
import { isInstanceable } from './instanceableModel'
import { statsOf, type SceneStats } from './sceneStats'
import type { SceneNode, SceneState } from './sceneState'

export type OptimizationClassification =
  'STATIC' | 'DYNAMIC' | 'SKINNED' | 'ANIMATED' | 'INSTANCABLE' | 'UNSAFE'

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
  host: Object3D,
  objectOf: (id: string) => Object3D | undefined,
  policy: OptimizationPolicy = DEFAULT_OPTIMIZATION_POLICY,
): OptimizationPlan {
  const animated = new Set(state.animation.tracks.map(track => track.target.nodeId))
  const meshes = drawnMeshesOf(state.nodes, host, objectOf)
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
    if (!nodeClassifications.includes('INSTANCABLE') || !object || !isDrawn(object, host)) continue

    for (const mesh of ownMeshesOf(node, object).filter(mesh => isDrawn(mesh, host))) {
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
    .map(([key, group]) => ({
      key,
      sourceIds: [...group.ids].sort(byCodeUnit),
      meshCount: group.meshes,
    }))
    .sort((one, other) => byCodeUnit(one.key, other.key))
  const sceneStats = statsOf(meshes)
  const savedDraws = instances.reduce((saved, group) => saved + group.meshCount - 1, 0)

  return {
    classifications,
    instances,
    warnings,
    measured: {
      ...sceneStats,
      objects: state.nodes.length,
      meshes: meshes.length,
      geometryBytes: geometryBytesOf(meshes),
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
  const meshes = object ? ownMeshesOf(node, object) : []
  const skinned = meshes.some(mesh => mesh instanceof SkinnedMesh)
  const dynamic = movesOnItsOwn(node.components)
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

function ownMeshesOf(node: SceneNode, object: Object3D): Mesh[] {
  if (node.type === 'mesh') return object instanceof Mesh ? [object] : []
  if (node.type !== 'model') return []
  const meshes: Mesh[] = []
  object.traverse(child => {
    if (child instanceof Mesh) meshes.push(child)
  })
  return meshes
}

function drawnMeshesOf(
  nodes: readonly SceneNode[],
  host: Object3D,
  objectOf: (id: string) => Object3D | undefined,
): Mesh[] {
  const found = new Set<Mesh>()
  for (const node of nodes) {
    const object = objectOf(node.id)
    if (!object || !isDrawn(object, host)) continue
    for (const mesh of ownMeshesOf(node, object)) if (isDrawn(mesh, host)) found.add(mesh)
  }
  return [...found]
}

function geometryBytesOf(meshes: readonly Mesh[]): number {
  const geometries = new Set<BufferGeometry>()
  const arrays = new Set<ArrayBufferView>()
  for (const mesh of meshes) geometries.add(mesh.geometry)
  for (const geometry of geometries) {
    if (geometry.index) arrays.add(geometry.index.array)
    for (const attribute of Object.values(geometry.attributes)) arrays.add(attribute.array)
  }
  return [...arrays].reduce((bytes, array) => bytes + array.byteLength, 0)
}

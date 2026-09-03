import {
  Mesh,
  SkinnedMesh,
  type BufferGeometry,
  type Material,
  type Object3D,
  type Texture,
} from 'three'
import { movesOnItsOwn } from '@shared/domain/component'
import { byCodeUnit } from '@shared/text'
import { WORTH_INSTANCING, groupingExclusions, isDrawn, shapeAndPaint, withFlags } from './grouping'
import { isInstanceable } from './instanceableModel'
import { statsOf, textureBytesOf, texturesOf, type SceneStats } from './sceneStats'
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
  sharedMaterials: number
}

export type OptimizationImpact = {
  drawCallsBefore: number
  drawCallsAfter: number
  avoidedGeometryBytes: number
  avoidedTextureBytes: number
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

type CandidateGroup = { ids: Set<string>; meshes: number; forced: boolean }

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
  policy: OptimizationPolicy = DEFAULT_OPTIMIZATION_POLICY,
  runtimeNodes: readonly SceneNode[] = state.nodes,
): OptimizationPlan {
  const animated = new Set(state.animation.tracks.map(track => track.target.nodeId))
  const excluded = groupingExclusions(runtimeNodes, animated, 'instance')
  // Enumerated ONCE per node: read again for the classification and again for the grouping, a
  // model of P primitives paid three full `traverse` walks for one pass.
  const drawn = new Set<Mesh>()
  const candidateGroups = new Map<string, CandidateGroup>()
  const keyOf = withFlags(shapeAndPaint())
  const classifications: ClassifiedObject[] = []
  const warnings: OptimizationWarning[] = []

  for (const node of state.nodes) {
    const object = objectOf(node.id)
    const own = object ? ownMeshesOf(node, object) : []
    const shown = object && isDrawn(object, host) ? own.filter(mesh => isRendered(mesh, host)) : []
    for (const mesh of shown) drawn.add(mesh)

    const nodeClassifications = classificationsOf(node, object, animated.has(node.id), own)
    classifications.push({ id: node.id, classifications: nodeClassifications })

    const reason = warningOf(nodeClassifications)
    if (reason) warnings.push({ nodeId: node.id, reason })
    if (excluded.has(node.id) || !nodeClassifications.includes('INSTANCABLE')) continue

    for (const mesh of shown) {
      if (Array.isArray(mesh.material)) continue
      const key = keyOf(node, mesh)
      const group = candidateGroups.get(key)
      if (group) {
        group.ids.add(node.id)
        group.meshes += 1
        group.forced ||= node.optimization?.mode === 'instance'
      } else {
        candidateGroups.set(key, {
          ids: new Set([node.id]),
          meshes: 1,
          forced: node.optimization?.mode === 'instance',
        })
      }
    }
  }

  const instances = [...candidateGroups]
    .filter(([, group]) => group.forced || group.meshes >= policy.minInstancesPerGroup)
    .map(([key, group]) => ({
      key,
      sourceIds: [...group.ids].sort(byCodeUnit),
      meshCount: group.meshes,
    }))
    .sort((one, other) => byCodeUnit(one.key, other.key))
  const meshes = [...drawn]
  const sceneStats = statsOf(meshes)
  const sharing = sharingOf(meshes)
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
      sharedMaterials: sharing.sharedMaterials,
    },
    estimated: {
      drawCallsBefore: sceneStats.draws,
      drawCallsAfter: Math.max(0, sceneStats.draws - savedDraws),
      avoidedGeometryBytes: sharing.avoidedGeometryBytes,
      avoidedTextureBytes: sharing.avoidedTextureBytes,
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

function sharingOf(
  meshes: readonly Mesh[],
): Pick<OptimizationImpact, 'avoidedGeometryBytes' | 'avoidedTextureBytes'> &
  Pick<OptimizationMetrics, 'sharedMaterials'> {
  const geometries = new Map<BufferGeometry, number>()
  const materials = new Map<Material, number>()
  const textures = new Map<Texture, number>()
  for (const mesh of meshes) {
    geometries.set(mesh.geometry, (geometries.get(mesh.geometry) ?? 0) + 1)
    const worn = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const material of worn) {
      materials.set(material, (materials.get(material) ?? 0) + 1)
      for (const texture of texturesOf(material)) {
        textures.set(texture, (textures.get(texture) ?? 0) + 1)
      }
    }
  }

  return {
    avoidedGeometryBytes: avoidedBytes(geometries, geometryByteLength),
    avoidedTextureBytes: avoidedBytes(textures, textureBytesOf),
    sharedMaterials: sharedReferences(materials),
  }
}

function avoidedBytes<T>(
  references: ReadonlyMap<T, number>,
  bytesOf: (value: T) => number,
): number {
  let bytes = 0
  for (const [value, count] of references) bytes += Math.max(0, count - 1) * bytesOf(value)
  return bytes
}

function sharedReferences<T>(references: ReadonlyMap<T, number>): number {
  let count = 0
  for (const uses of references.values()) count += Math.max(0, uses - 1)
  return count
}

function geometryByteLength(geometry: BufferGeometry): number {
  const arrays = new Set<ArrayBufferView>()
  if (geometry.index) arrays.add(geometry.index.array)
  for (const attribute of Object.values(geometry.attributes)) arrays.add(attribute.array)
  return [...arrays].reduce((bytes, array) => bytes + array.byteLength, 0)
}

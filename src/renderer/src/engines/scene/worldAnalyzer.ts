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
import { stableKey } from '@shared/hash'
import {
  WORTH_INSTANCING,
  behavioralGroupingExclusions,
  isDrawn,
  shapeAndPaint,
  withFlags,
} from './grouping'
import { isInstanceable } from './instanceableModel'
import { EMPTY_STATS, statsOf, textureBytesOf, texturesOf, type SceneStats } from './sceneStats'
import type { SceneNode, SceneState } from './sceneState'
import { batchKeyOf } from './batching'
import { bakeCandidatesOf, type BakeCandidate } from './bakeCandidates'

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

export type BatchCandidate = InstanceCandidate

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

export type OptimizationPlan = {
  classifications: readonly ClassifiedObject[]
  instances: readonly InstanceCandidate[]
  bakeCandidates: readonly BakeCandidate[]
  batches: readonly BatchCandidate[]
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

export type OptimizationPolicy = {
  minInstancesPerGroup: number
  analysisChunkSize: number
}

export const DEFAULT_OPTIMIZATION_POLICY: OptimizationPolicy = {
  minInstancesPerGroup: WORTH_INSTANCING,
  analysisChunkSize: 100,
}

type CandidateGroup = { ids: Set<string>; units: Set<string>; forced: boolean }

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
  return complete(optimizationSteps(state, host, objectOf, policy, runtimeNodes, true))
}

export async function analyzeOptimizationAsync(
  state: Pick<SceneState, 'nodes' | 'animation'>,
  host: Object3D,
  objectOf: (id: string) => Object3D | undefined,
  policy: OptimizationPolicy = DEFAULT_OPTIMIZATION_POLICY,
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
  policy: OptimizationPolicy,
  runtimeNodes: readonly SceneNode[],
  includeBakeCandidates: boolean,
): Generator<void, OptimizationPlan> {
  const analysis = new WorldAnalysis(state, host, objectOf, policy, runtimeNodes)
  yield* analysis.scan()
  return analysis.plan(includeBakeCandidates)
}

class WorldAnalysis {
  private readonly animated: Set<string>
  private readonly excluded: ReadonlySet<string>
  private readonly drawn = new Set<Mesh>()
  private readonly seenStats = { geometries: new Set<unknown>(), textures: new Set<unknown>() }
  private readonly sceneStats = { ...EMPTY_STATS }
  private readonly geometryArrays = new Set<ArrayBufferView>()
  private readonly geometryUses = new Map<BufferGeometry, number>()
  private readonly materialUses = new Map<Material, number>()
  private readonly textureUses = new Map<Texture, number>()
  private readonly candidateGroups = new Map<string, CandidateGroup>()
  private readonly batchGroups = new Map<string, CandidateGroup>()
  private readonly keyOf = withFlags(shapeAndPaint())
  private readonly batchKey = batchKeyOf()
  private readonly classifications: ClassifiedObject[] = []
  private readonly warnings: OptimizationWarning[] = []
  private geometryBytes = 0
  private avoidedGeometryBytes = 0
  private avoidedTextureBytes = 0
  private sharedMaterials = 0
  private visibleObjects = 0

  constructor(
    private readonly state: Pick<SceneState, 'nodes' | 'animation'>,
    private readonly host: Object3D,
    private readonly objectOf: (id: string) => Object3D | undefined,
    private readonly policy: OptimizationPolicy,
    private readonly runtimeNodes: readonly SceneNode[],
  ) {
    this.animated = new Set(state.animation.tracks.map(track => track.target.nodeId))
    this.excluded = behavioralGroupingExclusions(runtimeNodes, this.animated)
  }

  *scan(): Generator<void> {
    for (const node of this.state.nodes) {
      const object = this.objectOf(node.id)
      const own: Mesh[] = []
      if (object) yield* collectOwnMeshes(node, object, own)
      const shown =
        object && isDrawn(object, this.host)
          ? own.filter(mesh => isRendered(mesh, this.host))
          : []
      if (shown.length > 0) this.visibleObjects += 1
      for (const mesh of shown) {
        this.recordMesh(mesh)
        yield
      }
      const found = classificationsOf(node, object, this.animated.has(node.id), own)
      this.classifications.push({ id: node.id, classifications: found })
      const reason = warningOf(found)
      if (reason) this.warnings.push({ nodeId: node.id, reason })
      if (found.includes('INSTANCABLE')) yield* this.recordCandidates(node, shown)
      else yield
    }
  }

  private recordMesh(mesh: Mesh): void {
    this.drawn.add(mesh)
    const added = statsOf([mesh], this.seenStats)
    this.sceneStats.triangles += added.triangles
    this.sceneStats.vertices += added.vertices
    this.sceneStats.draws += added.draws
    this.sceneStats.textureBytes += added.textureBytes
    const uses = this.geometryUses.get(mesh.geometry) ?? 0
    this.geometryUses.set(mesh.geometry, uses + 1)
    if (uses > 0) this.avoidedGeometryBytes += geometryByteLength(mesh.geometry)
    for (const array of geometryArraysOf(mesh.geometry)) {
      if (this.geometryArrays.has(array)) continue
      this.geometryArrays.add(array)
      this.geometryBytes += array.byteLength
    }
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      this.recordMaterial(material)
    }
  }

  private recordMaterial(material: Material): void {
    const uses = this.materialUses.get(material) ?? 0
    this.materialUses.set(material, uses + 1)
    if (uses > 0) this.sharedMaterials += 1
    for (const texture of texturesOf(material)) {
      const textureUses = this.textureUses.get(texture) ?? 0
      this.textureUses.set(texture, textureUses + 1)
      if (textureUses > 0) this.avoidedTextureBytes += textureBytesOf(texture)
    }
  }

  private *recordCandidates(node: SceneNode, meshes: readonly Mesh[]): Generator<void> {
    for (const [index, mesh] of meshes.entries()) {
      if (Array.isArray(mesh.material)) continue
      const unit = stableKey([node.id, index])
      if (!this.excluded.has(node.id)) {
        collectCandidate(this.candidateGroups, this.keyOf(node, mesh), node, unit, 'instance')
        collectCandidate(this.batchGroups, this.batchKey(node, mesh), node, unit, 'batch')
      }
      yield
    }
  }

  plan(includeBakeCandidates: boolean): OptimizationPlan {
    const all = candidateRows(this.candidateGroups)
    const instances = acceptedCandidates(all, this.policy.minInstancesPerGroup)
    const batches = acceptedCandidates(candidateRows(this.batchGroups), 2)
    const instancedUnits = acceptedUnits(all, this.policy.minInstancesPerGroup)
    const saved = savedDraws(instances, this.batchGroups, instancedUnits)
    return {
      classifications: this.classifications,
      instances,
      bakeCandidates: includeBakeCandidates
        ? bakeCandidatesOf(this.state.nodes, this.runtimeNodes, this.animated)
        : [],
      batches,
      warnings: this.warnings,
      measured: this.metrics(),
      estimated: this.impact(saved),
    }
  }

  private metrics(): OptimizationMetrics {
    return {
      ...this.sceneStats,
      objects: this.state.nodes.length,
      visibleObjects: this.visibleObjects,
      meshes: this.drawn.size,
      geometryBytes: this.geometryBytes,
      sharedMaterials: this.sharedMaterials,
    }
  }

  private impact(saved: number): OptimizationImpact {
    return {
      drawCallsBefore: this.sceneStats.draws,
      drawCallsAfter: Math.max(0, this.sceneStats.draws - saved),
      avoidedGeometryBytes: this.avoidedGeometryBytes,
      avoidedTextureBytes: this.avoidedTextureBytes,
    }
  }
}

type CandidateRow = InstanceCandidate & { units: Set<string>; forced: boolean }

function candidateRows(groups: ReadonlyMap<string, CandidateGroup>): CandidateRow[] {
  return [...groups].map(([key, group]) => ({
    key,
    sourceIds: [...group.ids].sort(byCodeUnit),
    meshCount: group.units.size,
    units: group.units,
    forced: group.forced,
  }))
}

function acceptedCandidates(rows: readonly CandidateRow[], minimum: number): InstanceCandidate[] {
  return rows
    .filter(row => row.forced || row.meshCount >= minimum)
    .map(({ key, sourceIds, meshCount }) => ({ key, sourceIds, meshCount }))
    .sort((one, other) => byCodeUnit(one.key, other.key))
}

function acceptedUnits(rows: readonly CandidateRow[], minimum: number): Set<string> {
  return new Set(rows.filter(row => row.forced || row.meshCount >= minimum).flatMap(row => [...row.units]))
}

function savedDraws(
  instances: readonly InstanceCandidate[],
  batches: ReadonlyMap<string, CandidateGroup>,
  instanced: ReadonlySet<string>,
): number {
  const instanceSavings = instances.reduce((saved, group) => saved + group.meshCount - 1, 0)
  return [...batches.values()].reduce((saved, group) => {
    const remaining = [...group.units].filter(unit => !instanced.has(unit)).length
    return saved + Math.max(0, remaining - 1)
  }, instanceSavings)
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

function geometryArraysOf(geometry: BufferGeometry): ArrayBufferView[] {
  const arrays = new Set<ArrayBufferView>()
  if (geometry.index) arrays.add(geometry.index.array)
  for (const attribute of Object.values(geometry.attributes)) arrays.add(attribute.array)
  return [...arrays]
}

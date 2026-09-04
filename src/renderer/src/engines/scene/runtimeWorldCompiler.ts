import { stableKey } from '@shared/hash'
import { byCodeUnit } from '@shared/text'
import { Euler, Matrix4, Quaternion, Vector3 } from 'three'
import {
  DEFAULT_OPTIMIZATION_POLICY,
  type OptimizationPolicy,
} from '@shared/domain/optimizationPolicy'
import type { AnimationTimeline } from '@shared/domain/animation'
import type { SceneWorld } from '@shared/domain/scene'
import { behavioralGroupingExclusions, type RuntimeRenderArtifact } from './grouping'
import type { SceneNode, SceneState } from './sceneState'
import {
  validateSafeRuntime,
  type SafeValidationCamera,
  type SafeRuntimeValidationInput,
  type SafeRuntimeValidationReport,
} from './safeRuntimeValidation'
import type { VisualFrame } from './visualRegression'
import { sceneRuntimeSnapshot } from './sceneRuntimeSnapshot'
import { adaptiveCellsOf } from './adaptivePartition'

export type OptimizationSignature = string

export type RuntimeWorldPatch = {
  readonly changedNodes: readonly SceneNode[]
  readonly removedIds: readonly string[]
  readonly order: readonly string[] | null
  readonly world: SceneWorld | null
  readonly animation: AnimationTimeline | null
}

export type RuntimeCompilationReport = {
  readonly compiledNodes: number
  readonly reusedNodes: number
  readonly removedNodes: number
  readonly cachedNodes: number
  readonly compilationMs: number
  readonly compiledArtifacts: number
  readonly reusedArtifacts: number
}

export type RuntimeOptimization = {
  readonly artifacts: readonly RuntimeRenderArtifact[]
}

export type RuntimeWorld = SceneState & {
  readonly runtimeOptimization: RuntimeOptimization
}

export type RuntimeWorldCompiler = {
  compileRuntimeWorld: (world: SceneState) => RuntimeWorld
  compileRuntimeRegion: (patch: RuntimeWorldPatch) => RuntimeWorld | null
  invalidateOptimization: (entityIds: readonly string[]) => void
  getOptimizationReport: () => RuntimeCompilationReport
  clearOptimizationCache: () => void
  validateSafeWorld: (
    world: SceneState,
    input: RuntimeWorldValidationInput,
  ) => Promise<SafeRuntimeValidationReport>
}

export type RuntimeWorldValidationInput = Pick<
  SafeRuntimeValidationInput,
  'cameras' | 'visualOptions'
> & {
  renderOriginal: (world: SceneState, camera: SafeValidationCamera) => Promise<VisualFrame>
  renderOptimized: (world: RuntimeWorld, camera: SafeValidationCamera) => Promise<VisualFrame>
}

const EMPTY_REPORT: RuntimeCompilationReport = {
  compiledNodes: 0,
  reusedNodes: 0,
  removedNodes: 0,
  cachedNodes: 0,
  compilationMs: 0,
  compiledArtifacts: 0,
  reusedArtifacts: 0,
}

/** Describes one immutable authoring change without serializing the unchanged world. */
export function runtimeWorldPatch(previous: SceneState, next: SceneState): RuntimeWorldPatch {
  const changedNodes: SceneNode[] = []
  if (previous.nodes.length === next.nodes.length) {
    let sameOrder = true
    for (let index = 0; index < next.nodes.length; index += 1) {
      const before = previous.nodes[index]
      const after = next.nodes[index]
      if (!before || !after || before.id !== after.id) {
        sameOrder = false
        break
      }
      if (before !== after) changedNodes.push(after)
    }
    if (sameOrder) return patchOf(previous, next, changedNodes, [], null)
  }

  changedNodes.length = 0
  const before = new Map(previous.nodes.map(node => [node.id, node]))
  for (const node of next.nodes) if (before.get(node.id) !== node) changedNodes.push(node)
  const alive = new Set(next.nodes.map(node => node.id))
  const removedIds = previous.nodes.flatMap(node => (alive.has(node.id) ? [] : [node.id]))
  return patchOf(
    previous,
    next,
    changedNodes,
    removedIds,
    next.nodes.map(node => node.id),
  )
}

function patchOf(
  previous: SceneState,
  next: SceneState,
  changedNodes: readonly SceneNode[],
  removedIds: readonly string[],
  order: readonly string[] | null,
): RuntimeWorldPatch {
  return {
    changedNodes,
    removedIds,
    order,
    world: previous.world === next.world ? null : next.world,
    animation: previous.animation === next.animation ? null : next.animation,
  }
}

export function runtimeWorldPatchIsEmpty(patch: RuntimeWorldPatch): boolean {
  return (
    patch.changedNodes.length === 0 &&
    patch.removedIds.length === 0 &&
    patch.order === null &&
    patch.world === null &&
    patch.animation === null
  )
}

export function worldWithRuntimePatch(world: SceneState, patch: RuntimeWorldPatch): SceneState {
  const changed = new Map(patch.changedNodes.map(node => [node.id, node]))
  const removed = new Set(patch.removedIds)
  const nodes = world.nodes
    .filter(node => !removed.has(node.id))
    .map(node => changed.get(node.id) ?? node)
  const held = new Set(nodes.map(node => node.id))
  for (const node of patch.changedNodes) if (!held.has(node.id)) nodes.push(node)
  const byId = new Map(nodes.map(node => [node.id, node]))

  return {
    ...world,
    nodes: patch.order
      ? patch.order.flatMap(id => {
          const node = byId.get(id)
          return node ? [node] : []
        })
      : nodes,
    world: patch.world ?? world.world,
    animation: patch.animation ?? world.animation,
  }
}

/** Owns the disposable runtime state and applies only deltas proven by the authoring store. */
export function createRuntimeWorldCompiler(): RuntimeWorldCompiler {
  const nodes = new Map<string, SceneNode>()
  const invalidated = new Set<string>()
  let runtime: RuntimeWorld | null = null
  let artifacts = new Map<string, RuntimeRenderArtifact>()
  let report = EMPTY_REPORT

  const compileRuntimeWorld = (world: SceneState): RuntimeWorld => {
    const started = performance.now()
    nodes.clear()
    for (const node of world.nodes) nodes.set(node.id, node)
    invalidated.clear()
    const compiledArtifacts = runtimeArtifactsOf(world.nodes, world.animation)
    artifacts = new Map(compiledArtifacts.map(artifact => [artifact.signature, artifact]))
    runtime = runtimeState(world, world.nodes, compiledArtifacts)
    report = {
      compiledNodes: world.nodes.length,
      reusedNodes: 0,
      removedNodes: 0,
      cachedNodes: nodes.size,
      compilationMs: performance.now() - started,
      compiledArtifacts: compiledArtifacts.length,
      reusedArtifacts: 0,
    }
    return runtime
  }

  const compileRuntimeRegion = (patch: RuntimeWorldPatch): RuntimeWorld | null => {
    if (!runtime) return null
    const started = performance.now()
    let compiledNodes = 0
    let artifactInputsChanged = patch.removedIds.length > 0 || patch.animation !== null
    const forceArtifactCompilation = invalidated.size > 0
    if (invalidated.size > 0) {
      artifactInputsChanged = true
      const changedIds = new Set(patch.changedNodes.map(node => node.id))
      for (const id of invalidated) {
        const previous = nodes.get(id)
        if (!previous || changedIds.has(id)) continue
        nodes.set(id, structuredClone(previous))
        compiledNodes += 1
      }
    }

    for (const node of patch.changedNodes) {
      const previous = nodes.get(node.id)
      if (previous && !invalidated.has(node.id) && stableKey(previous) === stableKey(node)) {
        continue
      }
      if (!previous || artifactInputSignature(previous) !== artifactInputSignature(node)) {
        artifactInputsChanged = true
      }
      nodes.set(node.id, node)
      compiledNodes += 1
    }
    let removedNodes = 0
    for (const id of patch.removedIds) {
      if (nodes.delete(id)) removedNodes += 1
    }
    const ordered = patch.order
      ? patch.order.flatMap(id => {
          const node = nodes.get(id)
          return node ? [node] : []
        })
      : runtime.nodes.flatMap(node => {
          const current = nodes.get(node.id)
          return current ? [current] : []
        })
    let compiledArtifacts = 0
    let reusedArtifacts = runtime.runtimeOptimization.artifacts.length
    const heldArtifacts = artifactInputsChanged
      ? runtimeArtifactsOf(ordered, patch.animation ?? runtime.animation).map(artifact => {
          const held = forceArtifactCompilation ? undefined : artifacts.get(artifact.signature)
          if (held) return held
          compiledArtifacts += 1
          return artifact
        })
      : runtime.runtimeOptimization.artifacts
    invalidated.clear()
    if (artifactInputsChanged) reusedArtifacts = heldArtifacts.length - compiledArtifacts
    artifacts = new Map(heldArtifacts.map(artifact => [artifact.signature, artifact]))
    runtime = runtimeState(
      {
        ...runtime,
        world: patch.world ?? runtime.world,
        animation: patch.animation ?? runtime.animation,
      },
      ordered,
      heldArtifacts,
    )
    report = {
      compiledNodes,
      reusedNodes: ordered.length - compiledNodes,
      removedNodes,
      cachedNodes: nodes.size,
      compilationMs: performance.now() - started,
      compiledArtifacts,
      reusedArtifacts,
    }
    return runtime
  }

  return {
    compileRuntimeWorld,
    compileRuntimeRegion,
    invalidateOptimization: entityIds => {
      for (const id of entityIds) invalidated.add(id)
    },
    getOptimizationReport: () => report,
    clearOptimizationCache: () => {
      nodes.clear()
      invalidated.clear()
      runtime = null
      artifacts.clear()
      report = EMPTY_REPORT
    },
    validateSafeWorld: async (world, input) => {
      const compiled = compileRuntimeWorld(world)
      return await validateSafeRuntime({
        ...input,
        renderOriginal: async camera => await input.renderOriginal(world, camera),
        renderOptimized: async camera => await input.renderOptimized(compiled, camera),
        observeOriginal: async () => sceneRuntimeSnapshot(world),
        observeOptimized: async () => sceneRuntimeSnapshot(compiled),
      })
    },
  }
}

function runtimeState(
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
  const groups = new Map<string, { nodes: SceneNode[]; forced: boolean }>()
  const batches = new Map<string, SceneNode[]>()
  for (const node of nodes) {
    if ((node.type !== 'mesh' && node.type !== 'model') || excluded.has(node.id) || !node.visible)
      continue
    const mode = node.optimization?.mode ?? 'auto'
    if (mode === 'batch') {
      const key = stableKey([
        node.type,
        node.type === 'mesh' ? node.material : node.model.assetId,
        node.castShadow,
        node.receiveShadow,
        node.optimization?.groupId ?? null,
      ])
      const members = batches.get(key)
      const spatial = spatialNodes.get(node.id) ?? node
      if (members) members.push(spatial)
      else batches.set(key, [spatial])
      continue
    }
    if (mode !== 'auto' && mode !== 'instance') continue
    const key = stableKey([
      node.type,
      node.type === 'mesh' ? [node.geometry, node.material, node.negative] : [node.model],
      node.castShadow,
      node.receiveShadow,
      node.optimization?.groupId ?? null,
    ])
    const members = groups.get(key)
    if (members) {
      members.nodes.push(spatialNodes.get(node.id) ?? node)
      members.forced ||= mode === 'instance'
    } else {
      groups.set(key, { nodes: [spatialNodes.get(node.id) ?? node], forced: mode === 'instance' })
    }
  }
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
  const compatible = new Map<string, Extract<SceneNode, { type: 'mesh' }>[]>()
  const parentIds = new Set(nodes.flatMap(node => (node.parentId ? [node.parentId] : [])))
  for (const node of nodes) {
    if (
      node.type !== 'mesh' ||
      (node.optimization?.mode !== undefined && node.optimization.mode !== 'auto') ||
      excluded.has(node.id) ||
      selected.has(node.id) ||
      parentIds.has(node.id) ||
      !node.visible
    )
      continue
    const compatibilityKey = stableKey([
      node.material,
      node.castShadow,
      node.receiveShadow,
      node.negative ?? false,
      mergeLayoutOf(node),
      node.optimization?.groupId ?? null,
    ])
    const members = compatible.get(compatibilityKey)
    const spatial = spatialNodes.get(node.id) ?? node
    if (spatial.type !== 'mesh') continue
    if (members) members.push(spatial)
    else compatible.set(compatibilityKey, [spatial])
  }

  const groups = new Map<string, Extract<SceneNode, { type: 'mesh' }>[]>()
  for (const [compatibilityKey, candidates] of compatible) {
    for (const { cell, nodes: members } of adaptiveCellsOf(candidates, policy)) {
      groups.set(stableKey([compatibilityKey, cell]), members)
    }
  }

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

function artifactInputSignature(node: SceneNode): string {
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

export const compileRuntimeWorld = (
  compiler: RuntimeWorldCompiler,
  world: SceneState,
): RuntimeWorld => compiler.compileRuntimeWorld(world)

export const compileRuntimeRegion = (
  compiler: RuntimeWorldCompiler,
  patch: RuntimeWorldPatch,
): RuntimeWorld | null => compiler.compileRuntimeRegion(patch)

export const invalidateOptimization = (
  compiler: RuntimeWorldCompiler,
  entityIds: readonly string[],
): void => compiler.invalidateOptimization(entityIds)

export const getOptimizationReport = (compiler: RuntimeWorldCompiler): RuntimeCompilationReport =>
  compiler.getOptimizationReport()

export const clearOptimizationCache = (compiler: RuntimeWorldCompiler): void =>
  compiler.clearOptimizationCache()

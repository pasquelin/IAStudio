import { stableKey } from '@shared/hash'
import {
  artifactInputSignature,
  compileArtifactWorld,
  forcedMeshKeyOf,
  membersWithForcedInstances,
  removeArtifactRegion,
  runtimeArtifactsOf,
  runtimeState,
  updateArtifactRegion,
} from './runtimeWorldArtifacts'
export { runtimeArtifactsOf, runtimeOptimizationOf } from './runtimeWorldArtifacts'
import { byCodeUnit } from '@shared/text'
import type { AnimationTimeline } from '@shared/domain/animation'
import type { SceneWorld } from '@shared/domain/scene'
import type { RuntimeRenderArtifact } from './grouping'
import type { SceneNode, SceneState } from './sceneState'
import {
  validateSafeRuntime,
  type SafeValidationCamera,
  type SafeRuntimeSnapshot,
  type SafeRuntimeValidationInput,
  type SafeRuntimeValidationReport,
} from './safeRuntimeValidation'
import type { VisualFrame } from './visualRegression'

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
  readonly analyzedArtifactNodes: number
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
  observeOriginal: (world: SceneState) => Promise<SafeRuntimeSnapshot>
  observeOptimized: (world: RuntimeWorld) => Promise<SafeRuntimeSnapshot>
}

const EMPTY_REPORT: RuntimeCompilationReport = {
  compiledNodes: 0,
  reusedNodes: 0,
  removedNodes: 0,
  cachedNodes: 0,
  compilationMs: 0,
  compiledArtifacts: 0,
  reusedArtifacts: 0,
  analyzedArtifactNodes: 0,
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
  let artifactRegions = new Map<string, readonly RuntimeRenderArtifact[]>()
  let artifactRegionByNode = new Map<string, string>()
  let artifactRegionMembers = new Map<string, Set<string>>()
  let regionalArtifacts = false
  let forcedMeshKeys = new Set<string>()
  let nodePositions = new Map<string, number>()
  let parentedNodes = 0
  let report = EMPTY_REPORT

  const compileRuntimeWorld = (world: SceneState): RuntimeWorld => {
    const started = performance.now()
    nodes.clear()
    for (const node of world.nodes) nodes.set(node.id, node)
    nodePositions = new Map(world.nodes.map((node, index) => [node.id, index]))
    parentedNodes = world.nodes.filter(node => node.parentId !== null).length
    invalidated.clear()
    const compiled = compileArtifactWorld(world.nodes, world.animation)
    const compiledArtifacts = compiled.artifacts
    artifactRegions = compiled.regions
    artifactRegionByNode = compiled.regionByNode
    artifactRegionMembers = compiled.regionMembers
    regionalArtifacts = compiled.regional
    forcedMeshKeys = compiled.forcedMeshKeys
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
      analyzedArtifactNodes: world.nodes.length,
    }
    return runtime
  }

  const affectedRegionsOf = (patch: RuntimeWorldPatch): Set<string> => {
    const affectedRegions = new Set<string>()
    for (const id of [
      ...patch.removedIds,
      ...patch.changedNodes.map(node => node.id),
      ...invalidated,
    ]) {
      const region = artifactRegionByNode.get(id)
      if (region) affectedRegions.add(region)
    }
    return affectedRegions
  }

  const cloneInvalidatedNodes = (patch: RuntimeWorldPatch): number => {
    const changedIds = new Set(patch.changedNodes.map(node => node.id))
    const removedIds = new Set(patch.removedIds)
    let compiledNodes = 0
    for (const id of invalidated) {
      if (removedIds.has(id)) continue
      const previous = nodes.get(id)
      if (!previous || changedIds.has(id)) continue
      nodes.set(id, structuredClone(previous))
      compiledNodes += 1
    }
    return compiledNodes
  }

  const applyChangedNodes = (patch: RuntimeWorldPatch, driven: ReadonlySet<string>,
    affectedRegions: Set<string>): { compiled: number; artifactsChanged: boolean; forcedChanged: boolean } => {
    let compiled = 0
    let artifactsChanged = false
    let forcedChanged = false
    for (const node of patch.changedNodes) {
      const previous = nodes.get(node.id)
      if (previous && !invalidated.has(node.id) && stableKey(previous) === stableKey(node)) {
        continue
      }
      if (!previous || artifactInputSignature(previous) !== artifactInputSignature(node)) {
        artifactsChanged = true
      }
      if (forcedMeshKeyOf(previous, driven) !== forcedMeshKeyOf(node, driven)) {
        forcedChanged = true
      }
      if (previous) {
        if (previous.parentId !== null && node.parentId === null) parentedNodes -= 1
        if (previous.parentId === null && node.parentId !== null) parentedNodes += 1
      } else if (node.parentId !== null) {
        parentedNodes += 1
      }
      nodes.set(node.id, node)
      updateArtifactRegion(node, artifactRegionByNode, artifactRegionMembers, affectedRegions)
      compiled += 1
    }
    return { compiled, artifactsChanged, forcedChanged }
  }

  const removePatchedNodes = (
    patch: RuntimeWorldPatch,
    current: RuntimeWorld,
    driven: ReadonlySet<string>,
  ): { removed: number; forcedChanged: boolean } => {
    let removed = 0
    let forcedChanged = false
    for (const id of patch.removedIds) {
      if (nodes.delete(id)) {
        const previous = current.nodes[nodePositions.get(id) ?? -1]
        if (forcedMeshKeyOf(previous, driven)) forcedChanged = true
        if (previous?.parentId !== null) parentedNodes -= 1
        removeArtifactRegion(id, artifactRegionByNode, artifactRegionMembers)
        removed += 1
      }
    }
    return { removed, forcedChanged }
  }

  const orderedPatchedNodes = (
    patch: RuntimeWorldPatch,
    current: RuntimeWorld,
    invalidatedIds: ReadonlySet<string>,
  ): SceneNode[] => {
    const ordered = patch.order
      ? patch.order.flatMap(id => {
          const node = nodes.get(id)
          return node ? [node] : []
        })
      : current.nodes.slice()
    if (!patch.order) {
      for (const id of [...patch.changedNodes.map(node => node.id), ...invalidatedIds]) {
        const index = nodePositions.get(id)
        const node = nodes.get(id)
        if (index !== undefined && node) ordered[index] = node
      }
    } else {
      nodePositions = new Map(ordered.map((node, index) => [node.id, index]))
    }
    return ordered
  }

  const compileRegionalArtifacts = (
    affectedRegions: ReadonlySet<string>,
    invalidatedIds: ReadonlySet<string>,
    animation: RuntimeWorld['animation'],
  ): { held: readonly RuntimeRenderArtifact[]; compiled: number; analyzed: number } => {
    let compiledArtifacts = 0
    let analyzedArtifactNodes = 0
    const previousArtifacts = artifacts
    const nextArtifacts = new Map(artifacts)
    for (const region of affectedRegions) {
      for (const artifact of artifactRegions.get(region) ?? []) nextArtifacts.delete(artifact.signature)
      const members = [...(artifactRegionMembers.get(region) ?? [])].flatMap(id => {
        const node = nodes.get(id)
        return node ? [node] : []
      })
      analyzedArtifactNodes += members.length
      if (members.length === 0) {
        artifactRegions.delete(region)
        continue
      }
      const compiledRegion = runtimeArtifactsOf(
        membersWithForcedInstances(members, forcedMeshKeys, animation), animation,
      ).map(artifact => {
          const forced = artifact.sourceIds.some(id => invalidatedIds.has(id))
          const held = invalidatedIds.size > 0 && forced ? undefined : previousArtifacts.get(artifact.signature)
          if (held) return held
          compiledArtifacts += 1
          return artifact
      })
      artifactRegions.set(region, compiledRegion)
      for (const artifact of compiledRegion) nextArtifacts.set(artifact.signature, artifact)
    }
    artifacts = nextArtifacts
    return { held: [...artifacts.values()].sort((a, b) => byCodeUnit(a.signature, b.signature)), compiled: compiledArtifacts, analyzed: analyzedArtifactNodes }
  }

  const compileWholeArtifacts = (
    ordered: readonly SceneNode[], animation: RuntimeWorld['animation'], invalidatedIds: ReadonlySet<string>,
  ): { held: readonly RuntimeRenderArtifact[]; compiled: number; analyzed: number } => {
    const compiled = compileArtifactWorld(ordered, animation)
    let compiledCount = 0
    const held = compiled.artifacts.map(artifact => {
      const forced = artifact.sourceIds.some(id => invalidatedIds.has(id))
      const cached = invalidatedIds.size > 0 && forced ? undefined : artifacts.get(artifact.signature)
      if (cached) return cached
      compiledCount += 1
      return artifact
    })
    artifactRegions = compiled.regions
    artifactRegionByNode = compiled.regionByNode
    artifactRegionMembers = compiled.regionMembers
    regionalArtifacts = compiled.regional
    forcedMeshKeys = compiled.forcedMeshKeys
    artifacts = new Map(held.map(artifact => [artifact.signature, artifact]))
    return { held, compiled: compiledCount, analyzed: ordered.length }
  }

  const artifactUpdate = (patch: RuntimeWorldPatch, current: RuntimeWorld,
    ordered: readonly SceneNode[], affectedRegions: ReadonlySet<string>,
    invalidatedIds: ReadonlySet<string>, changed: boolean, forcedChanged: boolean) => {
    if (!changed) return { held: current.runtimeOptimization.artifacts, compiled: 0, analyzed: 0 }
    const regional = regionalArtifacts && parentedNodes === 0 && patch.animation === null && !forcedChanged
    return regional
      ? compileRegionalArtifacts(affectedRegions, invalidatedIds, current.animation)
      : compileWholeArtifacts(ordered, patch.animation ?? current.animation, invalidatedIds)
  }

  const updateRuntimeReport = (started: number, ordered: readonly SceneNode[], compiledNodes: number,
    removedNodes: number, update: { held: readonly RuntimeRenderArtifact[]; compiled: number; analyzed: number },
    artifactsChanged: boolean): void => {
    report = {
      compiledNodes, reusedNodes: ordered.length - compiledNodes, removedNodes,
      cachedNodes: nodes.size, compilationMs: performance.now() - started,
      compiledArtifacts: update.compiled,
      reusedArtifacts: artifactsChanged ? update.held.length - update.compiled : update.held.length,
      analyzedArtifactNodes: update.analyzed,
    }
  }

  const compileRuntimeRegion = (patch: RuntimeWorldPatch): RuntimeWorld | null => {
    if (!runtime) return null
    const started = performance.now()
    const current = runtime
    const invalidatedIds = new Set(invalidated)
    const affectedRegions = affectedRegionsOf(patch)
    const driven = new Set((patch.animation ?? current.animation).tracks.map(track => track.target.nodeId))
    const cloned = cloneInvalidatedNodes(patch)
    const changed = applyChangedNodes(patch, driven, affectedRegions)
    const removed = removePatchedNodes(patch, current, driven)
    const ordered = orderedPatchedNodes(patch, current, invalidatedIds)
    const artifactsChanged = patch.removedIds.length > 0 || patch.animation !== null || invalidated.size > 0 || changed.artifactsChanged
    const update = artifactUpdate(patch, current, ordered, affectedRegions, invalidatedIds,
      artifactsChanged, changed.forcedChanged || removed.forcedChanged)
    invalidated.clear()
    runtime = runtimeState(
      {
        ...current,
        world: patch.world ?? current.world,
        animation: patch.animation ?? current.animation,
      },
      ordered,
      update.held,
    )
    updateRuntimeReport(started, ordered, cloned + changed.compiled, removed.removed, update, artifactsChanged)
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
      artifactRegions.clear()
      artifactRegionByNode.clear()
      artifactRegionMembers.clear()
      regionalArtifacts = false
      forcedMeshKeys.clear()
      nodePositions.clear()
      parentedNodes = 0
      report = EMPTY_REPORT
    },
    validateSafeWorld: async (world, input) => {
      const compiled = compileRuntimeWorld(world)
      return await validateSafeRuntime({
        ...input,
        renderOriginal: async camera => await input.renderOriginal(world, camera),
        renderOptimized: async camera => await input.renderOptimized(compiled, camera),
        observeOriginal: async () => await input.observeOriginal(world),
        observeOptimized: async () => await input.observeOptimized(compiled),
      })
    },
  }
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

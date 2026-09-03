import { stableKey } from '@shared/hash'
import type { AnimationTimeline } from '@shared/domain/animation'
import type { SceneWorld } from '@shared/domain/scene'
import type { SceneNode, SceneState } from './sceneState'
import {
  validateSafeRuntime,
  type SafeRuntimeValidationInput,
  type SafeRuntimeValidationReport,
} from './safeRuntimeValidation'
import { sceneRuntimeSnapshot } from './sceneRuntimeSnapshot'

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
}

export type RuntimeWorldCompiler = {
  compileRuntimeWorld: (world: SceneState) => SceneState
  compileRuntimeRegion: (patch: RuntimeWorldPatch) => SceneState | null
  invalidateOptimization: (entityIds: readonly string[]) => void
  getOptimizationReport: () => RuntimeCompilationReport
  clearOptimizationCache: () => void
  validateSafeWorld: (
    world: SceneState,
    input: Omit<SafeRuntimeValidationInput, 'observeOriginal' | 'observeOptimized'>,
  ) => Promise<SafeRuntimeValidationReport>
}

const EMPTY_REPORT: RuntimeCompilationReport = {
  compiledNodes: 0,
  reusedNodes: 0,
  removedNodes: 0,
  cachedNodes: 0,
  compilationMs: 0,
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

/** Owns the disposable runtime state and applies only deltas proven by the authoring store. */
export function createRuntimeWorldCompiler(): RuntimeWorldCompiler {
  const nodes = new Map<string, SceneNode>()
  const invalidated = new Set<string>()
  let runtime: SceneState | null = null
  let report = EMPTY_REPORT

  const compileRuntimeWorld = (world: SceneState): SceneState => {
    const started = performance.now()
    nodes.clear()
    for (const node of world.nodes) nodes.set(node.id, node)
    invalidated.clear()
    runtime = runtimeState(world, world.nodes)
    report = {
      compiledNodes: world.nodes.length,
      reusedNodes: 0,
      removedNodes: 0,
      cachedNodes: nodes.size,
      compilationMs: performance.now() - started,
    }
    return runtime
  }

  const compileRuntimeRegion = (patch: RuntimeWorldPatch): SceneState | null => {
    if (!runtime) return null
    const started = performance.now()
    const compiledNodes = compileNodes(nodes, invalidated, patch.changedNodes)
    const removedNodes = removeNodes(nodes, patch.removedIds)
    invalidated.clear()
    const ordered = orderedNodes(nodes, runtime.nodes, patch.order)
    runtime = runtimeState(
      {
        ...runtime,
        world: patch.world ?? runtime.world,
        animation: patch.animation ?? runtime.animation,
      },
      ordered,
    )
    report = {
      compiledNodes,
      reusedNodes: ordered.length - compiledNodes,
      removedNodes,
      cachedNodes: nodes.size,
      compilationMs: performance.now() - started,
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
      report = EMPTY_REPORT
    },
    validateSafeWorld: async (world, input) => {
      const compiled = compileRuntimeWorld(world)
      return await validateSafeRuntime({
        ...input,
        observeOriginal: async () => sceneRuntimeSnapshot(world),
        observeOptimized: async () => sceneRuntimeSnapshot(compiled),
      })
    },
  }
}

function compileNodes(
  cached: Map<string, SceneNode>,
  invalidated: ReadonlySet<string>,
  changed: readonly SceneNode[],
): number {
  let compiled = 0
  const changedIds = new Set(changed.map(node => node.id))
  for (const id of invalidated) {
    const previous = cached.get(id)
    if (!previous || changedIds.has(id)) continue
    cached.set(id, structuredClone(previous))
    compiled += 1
  }
  for (const node of changed) {
    const previous = cached.get(node.id)
    if (previous && !invalidated.has(node.id) && stableKey(previous) === stableKey(node)) continue
    cached.set(node.id, node)
    compiled += 1
  }
  return compiled
}

function removeNodes(cached: Map<string, SceneNode>, removed: readonly string[]): number {
  let count = 0
  for (const id of removed) if (cached.delete(id)) count += 1
  return count
}

function orderedNodes(
  cached: ReadonlyMap<string, SceneNode>,
  previous: readonly SceneNode[],
  order: readonly string[] | null,
): SceneNode[] {
  const ids = order ?? previous.map(node => node.id)
  return ids.flatMap(id => cached.get(id) ?? [])
}

function runtimeState(source: SceneState, nodes: readonly SceneNode[]): SceneState {
  return {
    nodes,
    selectedIds: [],
    world: source.world,
    animation: source.animation,
  }
}

export const compileRuntimeWorld = (
  compiler: RuntimeWorldCompiler,
  world: SceneState,
): SceneState => compiler.compileRuntimeWorld(world)

export const compileRuntimeRegion = (
  compiler: RuntimeWorldCompiler,
  patch: RuntimeWorldPatch,
): SceneState | null => compiler.compileRuntimeRegion(patch)

export const invalidateOptimization = (
  compiler: RuntimeWorldCompiler,
  entityIds: readonly string[],
): void => compiler.invalidateOptimization(entityIds)

export const getOptimizationReport = (compiler: RuntimeWorldCompiler): RuntimeCompilationReport =>
  compiler.getOptimizationReport()

export const clearOptimizationCache = (compiler: RuntimeWorldCompiler): void =>
  compiler.clearOptimizationCache()

import type { AnimationGraph, AnimationGraphModule } from '@shared/domain/animationGraph'
import { animationGraphPreset } from '@shared/domain/animationPresets'
import { textOf } from '@game/runtime/componentFields'
import type { SceneNode } from '@/engines/scene/sceneState'

/** One node an `Animator` drives, and the graph its component names. */
export type AnimatedNode = { nodeId: string; graph: AnimationGraph }

/**
 * Every node of a scene a state machine animates.
 *
 * 🛑 Read BEFORE the first step in both hosts: a machine cannot loop, finish or place a footfall
 * without a clip length, and a length lives in the file. Whoever draws asks for those files here.
 */
export function animatedNodesOf(
  nodes: readonly SceneNode[],
  graphOf: (ref: string) => AnimationGraph | null,
): AnimatedNode[] {
  return nodes.flatMap(node => {
    const held = node.components?.find(one => one.type === 'Animator') ?? null
    if (!held) return []

    const graph = graphOf(textOf(held, 'graph', ''))
    return graph ? [{ nodeId: node.id, graph }] : []
  })
}

/**
 * The graph a component names: a file of the project, or the shipped one when it names nothing.
 *
 * 🛑 ONE resolution for the three that need it — the world, the studio that preloads its clips,
 * and the exported game. Written twice, they answered differently for a name no file wears.
 */
export function graphNamed(
  modules: readonly AnimationGraphModule[],
): (ref: string) => AnimationGraph | null {
  const byPath = new Map(modules.map(module => [module.path, module.graph]))

  // 🛑 The table FIRST, even for the empty name: an exported game files the shipped preset under
  // it, with its clips rewritten to assets of the bundle — see `bundledGraphs`.
  return ref => byPath.get(ref) ?? (ref === '' ? animationGraphPreset('character') : null)
}

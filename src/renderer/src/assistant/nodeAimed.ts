import type { SceneNode, SceneState } from '@/engines/scene/sceneState'
import { nodeById } from '@/engines/scene/sceneState'

/**
 * The node a caller meant: its id, or its NAME when exactly one node carries it.
 *
 * 🛑 A name is what a spoken request has — the briefing lists both, and a model asked to light
 * « Lumière principale » sent the name as `nodeId` and was refused eight times in one request
 * (bench pass of 2026-08-25). Two nodes of one name resolve to neither: a guess between them
 * would edit the wrong object in silence.
 */
export function nodeAimed(state: SceneState, given: string): SceneNode | undefined {
  const byId = nodeById(state, given)
  if (byId) return byId

  const named = state.nodes.filter(one => one.name === given)
  return named.length === 1 ? named[0] : undefined
}

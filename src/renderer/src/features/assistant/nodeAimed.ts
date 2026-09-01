import { aimedAt } from '@shared/domain/target'
import type { SceneNode, SceneState } from '@/engines/scene/sceneState'
import { nodeById } from '@/engines/scene/sceneState'

/** The node a caller meant — `aimedAt` carries the rule and what it is worth. */
export function nodeAimed(state: SceneState, given: string): SceneNode | undefined {
  return aimedAt(state.nodes, id => nodeById(state, id), given)
}

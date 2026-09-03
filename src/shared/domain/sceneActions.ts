import type { AssistantAction } from './assistantAction'
import { SCENE_NODE_ACTIONS } from './sceneNodeActions'
import { SCENE_MODEL_ACTIONS } from './sceneModelActions'
import { SCENE_WORLD_ACTIONS } from './sceneWorldActions'

export const SCENE_ACTIONS: readonly AssistantAction[] = [
  ...SCENE_NODE_ACTIONS,
  ...SCENE_MODEL_ACTIONS,
  ...SCENE_WORLD_ACTIONS,
]

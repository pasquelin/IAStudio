import type { ActionHandlers } from './actionHandler'
import { SCENE_CAMERA_VIEW_HANDLERS } from './sceneCameraViewHandlers'
import { mounted, NO_SCENE, noSuchNode } from './sceneHandlerCore'
import { nodeTargets, selectNode } from './sceneNodeActions'
import { SCENE_NODE_APPEARANCE_HANDLERS } from './sceneNodeAppearanceHandlers'
import { SCENE_NODE_BASIC_HANDLERS } from './sceneNodeBasicHandlers'
import { readState } from './sceneStateHandler'
import { SCENE_WORLD_HANDLERS } from './sceneWorldHandlers'

export { mounted, NO_SCENE, nodeTargets, noSuchNode, selectNode }

export const SCENE_HANDLERS: ActionHandlers = {
  'scene.state': readState,
  ...SCENE_WORLD_HANDLERS,
  ...SCENE_NODE_BASIC_HANDLERS,
  ...SCENE_NODE_APPEARANCE_HANDLERS,
  ...SCENE_CAMERA_VIEW_HANDLERS,
}

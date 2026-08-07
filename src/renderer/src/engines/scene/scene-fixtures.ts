import { useScenes } from '@/stores/scenes'
import { createDefaultScene } from './default-scene'
import {
  DEFAULT_MATERIAL,
  IDENTITY_TRANSFORM,
  type LightDescriptor,
  type SceneNode,
  type SceneState,
} from './scene-state'

/**
 * Puts a scene in front of a panel under test, history cleared. Declared here so the store's
 * own shape lives in one place rather than in every suite that renders a scene panel.
 */
export function installScene(documentId: string, state: SceneState = createDefaultScene()): void {
  useScenes.setState({ states: { [documentId]: state }, histories: {} })
}

/**
 * Scene nodes for tests. Declared once so a new required field on `SceneNodeBase` breaks in one
 * place rather than in every suite that builds a node by hand.
 */
export function meshNode(id: string, parentId: string | null = null): SceneNode {
  return {
    id,
    parentId,
    name: id,
    visible: true,
    transform: IDENTITY_TRANSFORM,
    type: 'mesh',
    geometry: { kind: 'box', width: 1, height: 1, depth: 1 },
    material: DEFAULT_MATERIAL,
  }
}

export function lightNodeFixture(
  id: string,
  light: LightDescriptor = { kind: 'ambient', color: '#222222', intensity: 1 },
): SceneNode {
  return {
    id,
    parentId: null,
    name: id,
    visible: true,
    transform: IDENTITY_TRANSFORM,
    type: 'light',
    light,
  }
}

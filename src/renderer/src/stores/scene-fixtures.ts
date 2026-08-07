import { createDefaultScene } from '@/engines/scene/default-scene'
import type { SceneState } from '@/engines/scene/scene-state'
import { useDocuments } from './documents'
import { useScenes } from './scenes'

/**
 * Puts a scene document in front of a panel under test, history cleared. It declares the
 * descriptor too: a panel resolves its document through `activeIdOfKind`, so an id with no
 * descriptor behind it reads as "nothing open".
 *
 * It lives beside the stores rather than beside the node fixtures because their shape is what
 * it knows — and `engines/` must not reach for a store.
 */
export function installScene(documentId: string, state: SceneState = createDefaultScene()): void {
  useScenes.setState({ states: { [documentId]: state }, histories: {} })
  useDocuments.setState({
    documents: {
      [documentId]: { id: documentId, kind: 'scene', workspace: '3d', title: documentId },
    },
    activeId: documentId,
  })
}

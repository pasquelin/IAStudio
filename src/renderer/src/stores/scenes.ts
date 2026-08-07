import { selectNode } from '@/engines/scene/commands'
import { EMPTY_SCENE, type SceneState } from '@/engines/scene/scene-state'
import { createDocumentStore } from './document-store'

/** One scene per document, in memory like the documents themselves. */
const store = createDocumentStore<SceneState>(EMPTY_SCENE)

export const useScenes = store.use
export const sceneOf = store.stateOf
export const historyOf = store.historyOf

/**
 * Selection stays out of the history, so it writes the whole scene back — and the scene has to
 * be read at call time, not from the render that drew the row: a copy taken before whatever
 * command ran in between would undo it.
 */
export function selectIn(documentId: string, id: string | null): void {
  const state = useScenes.getState()
  state.replace(documentId, selectNode(sceneOf(state, documentId), id))
}

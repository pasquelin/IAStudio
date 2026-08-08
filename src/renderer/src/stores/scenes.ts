import { setSelection } from '@/engines/scene/commands'
import { EMPTY_SCENE, type SceneState } from '@/engines/scene/scene-state'
import type { SelectionMode } from '@/helpers/selection'
import { createDocumentStore } from './document-store'

/** One scene per document, in memory like the documents themselves. */
const store = createDocumentStore<SceneState>(EMPTY_SCENE)

export const useScenes = store.use
export const sceneOf = store.stateOf
export const hasScene = store.hasState
export const historyOf = store.historyOf
export const markOf = store.markOf
export const isDirty = store.isDirty

/**
 * Selection stays out of the history, so it writes the whole scene back — and the scene has to
 * be read at call time, not from the render that drew the row: a copy taken before whatever
 * command ran in between would undo it.
 */
export function selectIn(
  documentId: string,
  ids: readonly string[],
  mode: SelectionMode = 'replace',
): void {
  const state = useScenes.getState()
  state.replace(documentId, setSelection(sceneOf(state, documentId), ids, mode))
}

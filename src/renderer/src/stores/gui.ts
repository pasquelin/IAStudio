import type { SelectionMode } from '@/helpers/selection'
import { setUiSelection } from '@/engines/gui/guiCommands'
import { createDocumentStore } from './documentStore'
import { EMPTY_GUI, type GuiState } from '@/engines/gui/guiState'

const store = createDocumentStore<GuiState>(EMPTY_GUI)

export const guiStore = store

export const useGuis = store.use

export const isGuiDirty = store.isDirty

export const guiOf = store.stateOf

export const guiHistoryOf = store.historyOf

/**
 * What is designated, written WITHOUT an entry in the history — a click is not an edit, and a
 * ⌘Z that gave back a selection would cost one press per row before undoing anything.
 *
 * Guarded on the ids rather than on the state: clicking a row already selected is the gesture
 * that opens a drag, and writing the document back would have the stage redraw on it.
 */
export function selectInGui(
  documentId: string,
  ids: readonly string[],
  mode: SelectionMode = 'replace',
): void {
  const state = useGuis.getState()
  const current = guiOf(state, documentId)
  const next = setUiSelection(current, ids, mode)

  if (next.selectedIds !== current.selectedIds) state.replace(documentId, next)
}

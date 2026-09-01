import { create } from 'zustand'
import { samePicks } from '@/helpers/selection'

/** The rows of the project folder the studio's GLOBAL gestures act on, named by their PATH. */
type SelectionState = {
  filePaths: readonly string[]
  selectFiles: (paths: readonly string[]) => void
}

/** Stable, so a surface reading it through a selector does not re-render on every other pick. */
const NONE: readonly string[] = []

/** Read as a selector rather than off the state, so a surface subscribes to this and nothing else. */
export function selectedFilePaths(state: Pick<SelectionState, 'filePaths'>): readonly string[] {
  return state.filePaths
}

/**
 * Selection is not focus and not what is open: clicking selects, double-clicking opens. Global
 * rather than per document because the gestures reading it are — the explorer's menu, the folder
 * a new document opens in, what a generation is handed.
 */
export const useSelection = create<SelectionState>()(set => ({
  filePaths: NONE,
  // Guarded: the explorer re-picks the same row on the press that OPENS a drag.
  selectFiles: paths =>
    set(state => (samePicks(state.filePaths, paths) ? state : { filePaths: paths })),
}))

import { create } from 'zustand'
import { sameValues } from '@/helpers/objects'

/**
 * What the studio's GLOBAL gestures act on: what kind of thing, and which ones were picked.
 *
 * 🛑 Nothing that lives INSIDE a document is here — a layer, a node, a clip and a track are each
 * held by their own document. What is left belongs to the PROJECT, which is why ONE descriptor
 * still serves: it can only hold one kind, and a second writer would wipe the first.
 */
export type Selection =
  | { kind: 'none' }
  | { kind: 'asset'; ids: readonly string[] }
  /**
   * Rows of the project folder, named by their PATH — which is what a folder walk has and the
   * only thing that is unique in one.
   *
   * Held here so the explorer's commands and its context menu read ONE answer: both go through
   * `selectedFilePaths`, and a second copy would let them disagree.
   */
  | { kind: 'file'; ids: readonly string[] }

type SelectionState = {
  selection: Selection
  selectAssets: (ids: readonly string[]) => void
  selectFiles: (paths: readonly string[]) => void
  clear: () => void
}

const NONE: Selection = { kind: 'none' }

/** Stable, so a surface reading it through a selector does not re-render on every other pick. */
const NO_IDS: readonly string[] = []

/**
 * The picked assets, or none. Read as a selector rather than off `selection`: a panel that
 * watches the whole descriptor re-renders on every pick made anywhere in the studio, and an
 * asset shelf has no use for what an explorer designated.
 */
export function selectedAssetIds(state: Pick<SelectionState, 'selection'>): readonly string[] {
  return state.selection.kind === 'asset' ? state.selection.ids : NO_IDS
}

/**
 * The picked rows of the project folder, by path. Read the same way, and for the same reason:
 * the file commands watch this alone, and a picked asset must not wake them.
 */
export function selectedFilePaths(state: Pick<SelectionState, 'selection'>): readonly string[] {
  return state.selection.kind === 'file' ? state.selection.ids : NO_IDS
}

/**
 * Selection is not focus and not what is open: clicking selects, double-clicking opens. Global
 * rather than per document because the gestures reading it are — sending to the cloud, the
 * explorer's menu, the folder a new document opens in.
 */
export const useSelection = create<SelectionState>()(set => {
  const point = (next: Selection): void =>
    set(state => (sameValues(state.selection, next) ? state : { selection: next }))

  return {
    selection: NONE,

    selectAssets: ids => point(ids.length > 0 ? { kind: 'asset', ids } : NONE),
    selectFiles: ids => point(ids.length > 0 ? { kind: 'file', ids } : NONE),
    clear: () => point(NONE),
  }
})

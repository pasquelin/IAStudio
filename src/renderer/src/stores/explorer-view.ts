import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  COLLECTION_PERSIST_VERSION,
  DEFAULT_COLLECTION_STATE,
  withoutSearch,
  type CollectionState,
} from '@/helpers/collection-state'

/**
 * How the project is read: by where its files SIT, or by what they ARE.
 *
 * Two readings of one folder rather than two panels: the gestures, the menu and the selection
 * are the same in both, and the second is the only way to find every picture of a project whose
 * folders the user arranged their own way.
 */
export type ExplorerMode = 'folder' | 'domain'

export type ExplorerViewState = {
  /**
   * What the bar holds: the term searched, the sort, and which of the two renderings draws —
   * `list` is the tree, `grid` the thumbnails, with `thumbnailSize` sizing them.
   *
   * `view` is a second axis and not a third value of `mode`: the two multiply, so a domain has a
   * grid too. Whoever adds a rendering adds it here, and NOWHERE else — two places answering
   * "which view" is the one shape this panel must not grow.
   */
  collection: CollectionState
  /** Whether the studio's own bookkeeping is drawn — `.index/`, `.project.json`. */
  hidden: boolean
  mode: ExplorerMode
  setExplorerCollection: (collection: CollectionState) => void
  toggleExplorerHidden: () => void
  setExplorerMode: (mode: ExplorerMode) => void
}

/**
 * What the Explorer is showing, as opposed to what the project folder holds.
 *
 * A store rather than state inside the panel, and for one reason: `ExplorerActions` draws the
 * title row — how the folder is read, and how much of it is shown — and it is a different
 * component from the tree those two answers narrow. The shelf carries its own for the same reason.
 *
 * Written out rather than taken from `LIST_ONLY`, which means "this panel has no grid at all" and
 * is never persisted: this one starts on the tree because that is what `list` DRAWS here, and both
 * halves of a `CollectionState` are live.
 */
export const useExplorerView = create<ExplorerViewState>()(
  persist(
    set => ({
      collection: { ...DEFAULT_COLLECTION_STATE, view: 'list' },
      hidden: false,
      mode: 'folder',

      setExplorerCollection: collection => set({ collection }),
      toggleExplorerHidden: () => set(state => ({ hidden: !state.hidden })),
      setExplorerMode: mode => set({ mode }),
    }),
    {
      name: 'scenario-studio:explorer-view',
      // `search` is dropped by the policy every collection follows: a studio reopening on a tree
      // narrowed by a word nobody typed reads as a project gone missing.
      partialize: ({ collection, hidden, mode }) => ({
        collection: withoutSearch(collection),
        hidden,
        mode,
      }),
      version: COLLECTION_PERSIST_VERSION,
    },
  ),
)

/** What the search box holds, trimmed. Empty means the tree reads the folders lazily, as ever. */
export function explorerSearch(state: ExplorerViewState): string {
  return state.collection.search.trim()
}

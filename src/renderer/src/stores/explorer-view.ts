import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  COLLECTION_PERSIST_VERSION,
  LIST_ONLY,
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
  /** What the bar in the panel's title row holds: the term being searched, and the sort. */
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
 * A store rather than state inside the panel, and for one reason: the bar that carries the
 * search rides in the TITLE row — `ExplorerActions` — which is a different component from the
 * tree it narrows. The shelf carries its own for the same reason.
 *
 * `LIST_ONLY` as the ground state: a tree has neither thumbnails nor a grid, so the two halves
 * of `CollectionState` that describe one stay where a `CollectionState` puts them and are never
 * read here.
 */
export const useExplorerView = create<ExplorerViewState>()(
  persist(
    set => ({
      collection: LIST_ONLY,
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

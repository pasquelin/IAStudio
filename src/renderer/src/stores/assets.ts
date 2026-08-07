import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Asset } from '@shared/domain/asset'
import {
  COLLECTION_PERSIST_VERSION,
  DEFAULT_COLLECTION_STATE,
  type CollectionState,
} from '@/helpers/collection-state'
import { isRecord } from '@/helpers/guards'
import { getBridge } from '@/services/bridge'

type AssetsState = {
  collection: CollectionState
  setCollection: (collection: CollectionState) => void

  items: Asset[]
  refresh: () => Promise<void>
}

/** The shape the store persisted before it held a whole `CollectionState`. */
function readView(persisted: unknown): CollectionState['view'] | null {
  if (!isRecord(persisted) || !('view' in persisted)) return null
  const { view } = persisted
  return view === 'grid' || view === 'list' ? view : null
}

/**
 * How the browser is displayed lives in a store rather than in the component: its count is
 * rendered by the panel header, its grid by the content, and both must read the same list.
 *
 * Only the display is persisted. The catalogue belongs to the project, and a list restored
 * from the last session would show what a different project contained.
 */
export const useAssets = create<AssetsState>()(
  persist(
    set => ({
      collection: DEFAULT_COLLECTION_STATE,
      setCollection: collection => set({ collection }),

      items: [],

      refresh: async () => {
        const bridge = getBridge()
        if (!bridge) return

        try {
          set({ items: await bridge.assets.search({}) })
        } catch {
          // No project open: the catalogue throws, and an empty list is the honest answer.
          set({ items: [] })
        }
      },
    }),
    {
      name: 'scenario-studio:assets',
      version: COLLECTION_PERSIST_VERSION,
      /**
       * The store used to persist a bare `view`, before the state became a whole
       * `CollectionState`. Carried over rather than dropped: zustand would otherwise discard
       * the entry entirely, and with it the grid-or-list the user had chosen.
       */
      migrate: persisted => {
        const view = readView(persisted)
        return view ? { collection: { ...DEFAULT_COLLECTION_STATE, view } } : undefined
      },
      // The search text is dropped on purpose: reopening on a narrowed catalogue nobody typed
      // reads as a catalogue gone missing.
      partialize: state => ({ collection: { ...state.collection, search: '' } }),
    },
  ),
)

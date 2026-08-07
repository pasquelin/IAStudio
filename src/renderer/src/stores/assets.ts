import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Asset } from '@shared/domain/asset'
import {
  COLLECTION_PERSIST_VERSION,
  DEFAULT_COLLECTION_STATE,
  type CollectionState,
} from '@/helpers/collection-state'
import { isRecord } from '@shared/guards'
import { getBridge } from '@/services/bridge'

type AssetsState = {
  collection: CollectionState
  setCollection: (collection: CollectionState) => void

  // Readonly so nothing can mutate it in place: `assetsById` keys off its identity, and a push
  // that kept the same array would leave the index short of an asset with nothing to say so.
  items: readonly Asset[]
  refresh: () => Promise<void>
  /**
   * Says the catalogue changed and lets this store decide when to read it. `assets.search` is
   * a synchronous SQLite query in the main process: forty rushes finishing their ingest would
   * otherwise freeze every window forty times over.
   */
  invalidate: () => void
}

const COALESCE_MS = 200

/**
 * The catalogue keyed by id, derived from `items` rather than stored beside it: a second field
 * would have to be kept in step by every writer, and one that forgot would hand back a stale
 * asset with nothing to say so.
 *
 * The result is cached on the identity of `items`, so it is a stable value for zustand — a
 * fresh Map per call would re-render every subscriber on every notification. Five panels were
 * scanning the whole list for one asset, per render and per catalogue event.
 */
let indexed: { items: readonly Asset[]; byId: ReadonlyMap<string, Asset> } | null = null

export function assetsById(state: Pick<AssetsState, 'items'>): ReadonlyMap<string, Asset> {
  if (!indexed || indexed.items !== state.items) {
    indexed = { items: state.items, byId: new Map(state.items.map(asset => [asset.id, asset])) }
  }
  return indexed.byId
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
    (set, get) => {
      let pending: ReturnType<typeof setTimeout> | null = null

      return {
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

        invalidate: () => {
          if (pending) clearTimeout(pending)
          pending = setTimeout(() => {
            pending = null
            void get().refresh()
          }, COALESCE_MS)
        },
      }
    },
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

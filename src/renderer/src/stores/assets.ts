import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Asset, AssetType } from '@shared/domain/asset'
import {
  COLLECTION_PERSIST_VERSION,
  DEFAULT_COLLECTION_STATE,
  withoutSearch,
  type CollectionState,
} from '@/helpers/collection-state'
import { checkAssetName, type AssetNameFailure } from '@shared/domain/asset-name'
import { isRecord } from '@shared/guards'
import { getBridge } from '@/services/bridge'
import { reportFailure } from '@/services/diagnostics'

type AssetsState = {
  collection: CollectionState
  setCollection: (collection: CollectionState) => void

  // Readonly so nothing can mutate it in place: `assetsById` keys off its identity, and a push
  // that kept the same array would leave the index short of an asset with nothing to say so.
  items: readonly Asset[]
  /**
   * The kinds the catalogue is asked for. Set by whichever space is in front, so the query is
   * narrowed in SQL rather than after the fact — which is also what keeps the count in the
   * header and the "no asset" message honest about what is being looked at.
   */
  scope: readonly AssetType[] | null
  setScope: (scope: readonly AssetType[] | null) => void
  refresh: () => Promise<void>
  /**
   * Hears the writes the MAIN process makes on its own — the pictures a model sheds on import.
   * Every other write is answered where it was ordered, and invalidates the shelf there.
   */
  connect: () => Promise<() => void>
  /**
   * Says the catalogue changed and lets this store decide when to read it. `assets.search` is
   * a synchronous SQLite query in the main process: forty rushes finishing their ingest would
   * otherwise freeze every window forty times over.
   */
  invalidate: () => void
  /**
   * Calls an asset something else, in this project's catalogue.
   *
   * Local on purpose: the name on the Scenario account is not touched. One asset is pulled into
   * several projects and named for what each one does with it, and a rename that travelled would
   * have a project rename someone else's library.
   *
   * Answers with the refusal, or `null` when it went through — the field stays open on a refusal.
   */
  rename: (assetId: string, name: string) => Promise<AssetNameFailure | null>
  /**
   * Drops the coalesced read still waiting, if there is one.
   *
   * It exists for the test harness, and says so rather than pretending to a product need: the
   * timer `invalidate` arms lives at module scope, so a case that leaves one behind has it fire
   * inside a LATER case and refresh that one's catalogue under it. `test-setup` calls this after
   * every case — see the comment there for the failure it produces.
   *
   * The alternative was to leave production untouched and swap `globalThis.setTimeout` in the
   * harness for one that tracks every timer and clears them all after each case. It works — it
   * was tried. It is not what is here because it clears timers nobody knows about, so the next
   * leak of this kind is swallowed instead of named, and because a case that legitimately wants
   * a timer to outlive it would silently stop working. One named cancellation on the one store
   * that holds a module-scope timer says what it does.
   */
  cancelInvalidate: () => void
}

const COALESCE_MS = 200

/** Two scopes that ask for the same kinds, so a re-render does not re-read the catalogue. */
function sameScope(
  current: readonly AssetType[] | null,
  next: readonly AssetType[] | null,
): boolean {
  if (current === null || next === null) return current === next
  return current.length === next.length && current.every((type, index) => type === next[index])
}

/**
 * The catalogue keyed by id, derived from `items` rather than stored beside it: a second field
 * would have to be kept in step by every writer, and one that forgot would hand back a stale
 * asset with nothing to say so.
 *
 * The result is cached on the identity of `items`, so it is a stable value for zustand — a
 * fresh Map per call would re-render every subscriber on every notification. Five panels were
 * scanning the whole list for one asset, per render and per catalogue event.
 *
 * **It keeps every asset it has been shown, not only the ones `items` currently holds.** `items`
 * is a SCOPE — the kinds the browser is asking for — and narrowing that facet to meshes used to
 * take the names, the posters and the media lengths off the clips of an open montage: the strip
 * fell back to raw ids, lost its stills, and a trim stopped clamping at the end of the source.
 * A way of browsing is not a statement about what a document holds.
 */
let indexed: { items: readonly Asset[]; byId: ReadonlyMap<string, Asset> } | null = null

export function assetsById(state: Pick<AssetsState, 'items'>): ReadonlyMap<string, Asset> {
  if (!indexed || indexed.items !== state.items) {
    // Over what it already held, not from `items` alone: that is the remembering. A fresh Map
    // each time is what hands zustand a changed identity, so the scope's own rows still win.
    const byId = new Map(indexed?.byId)
    for (const asset of state.items) byId.set(asset.id, asset)
    indexed = { items: state.items, byId }
  }
  return indexed.byId
}

/**
 * Drops what the index remembers — every asset of the project being left.
 *
 * Called by `followProject`, beside `forgetReportedFailures` and for the same reason: another
 * project's catalogue is another story, and this map has no other way to shrink. The test
 * harness calls it too, as it calls `cancelInvalidate`: the map lives at module scope, so an
 * asset one case puts in the catalogue would still answer a lookup in the next one.
 */
export function forgetRememberedAssets(): void {
  indexed = null
}

/**
 * When the file behind an asset was last written, or nothing when the catalogue does not hold it
 * — the shelf is scoped, so a slot can name a row this store is not carrying.
 *
 * Read at the moment a slot asks rather than subscribed to: this is the port the three 3D engines
 * take (`assetVersion`), and an engine knows no store. What it is FOR is the id not moving when
 * ⌘S rewrites a picture — see `versionedUrl`.
 */
export function assetVersionOf(assetId: string): string | undefined {
  return assetsById(useAssets.getState()).get(assetId)?.localChangedAt
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
      let reading: Promise<void> | null = null
      // Which scope the read in flight is answering for.
      let readingScope: readonly AssetType[] | null = null

      return {
        collection: DEFAULT_COLLECTION_STATE,
        setCollection: collection => set({ collection }),

        items: [],
        scope: null,

        // A change of space changes what the catalogue is asked for, so the rows follow at once
        // rather than on the next invalidation.
        setScope: scope => {
          if (sameScope(get().scope, scope)) return

          set({ scope })
          void get().refresh()
        },

        // Callers that need the rows NOW share the read already in flight rather than opening a
        // second one: `assets.search` is a synchronous SQLite query in the main process, and
        // three generations finishing together asked for the same answer three times over.
        refresh: async () => {
          // Shared only when it answers the same question. A read in flight for the previous
          // space would otherwise be handed back for the new one, leaving the shelf showing
          // what the space one had just left uses.
          if (reading && sameScope(readingScope, get().scope)) return reading

          const scope = get().scope
          readingScope = scope

          reading = (async () => {
            const bridge = getBridge()
            if (!bridge) return

            try {
              set({ items: await bridge.assets.search(scope ? { types: [...scope] } : {}) })
            } catch {
              // No project open: the catalogue throws, and an empty list is the honest answer.
              set({ items: [] })
            }
          })().finally(() => {
            reading = null
          })

          return reading
        },

        connect: () => {
          const bridge = getBridge()
          // Through `invalidate` like every other site that says the catalogue moved, so the
          // coalescing holds: an extraction writing six pictures is one read, not six.
          const stop = bridge?.assets.onChanged(() => get().invalidate())
          return Promise.resolve(stop ?? (() => {}))
        },

        invalidate: () => {
          if (pending) clearTimeout(pending)
          pending = setTimeout(() => {
            pending = null
            void get().refresh()
          }, COALESCE_MS)
        },

        rename: async (assetId, name) => {
          const refused = checkAssetName(name)
          if (refused) return refused

          const written = await getBridge()
            ?.assets.update(assetId, { name: name.trim() })
            .catch(error => {
              reportFailure('assets.rename', name, error)
              return null
            })
          if (!written) return 'empty'

          // Written into the shelf rather than waited for: `assets:update` broadcasts nothing —
          // it is answered where it was ordered, which is the doctrine every other write follows.
          // Straight into `items` and not through `invalidate`, so the tile shows the new name on
          // the next paint instead of a third of a second later.
          set(state => ({
            items: state.items.map(item => (item.id === assetId ? written : item)),
          }))
          return null
        },

        cancelInvalidate: () => {
          if (pending) clearTimeout(pending)
          pending = null
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
      partialize: state => ({ collection: withoutSearch(state.collection) }),
    },
  ),
)

import { mdiCubeScan } from '@mdi/js'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MODEL_IDS_BATCH_LIMIT, type ModelPage, type ModelSummary } from '@shared/domain/model'
import { failureKeyOf } from '@/services/failure-message'
import { usePlanAccess, usePlanRefusal } from '@/helpers/plan-access'
import { Collection } from '@/design/Collection/Collection'
import { CollectionBar } from '@/design/CollectionBar/CollectionBar'
import { isFiltered } from '@/helpers/collection-state'
import { useModelForFamily } from '@/helpers/model-for-family'
import { useDebounced } from '@/hooks/useDebounced'
import { getBridge } from '@/services/bridge'
import { useLayouts } from '@/stores/layouts'
import { modelCollectionOf, useModels } from '@/stores/models'
import { useSettings } from '@/stores/settings'
import { workspaceById } from '@/helpers/workspaces'
import { EmptyState } from '@/design/EmptyState'
import { MissingCredentials } from '@/panels/shared/MissingCredentials'
import { facetsFor, queryFrom, sortOptions } from '../model-filters'
import { ModelsCard } from './ModelsCard'
import { ModelsRow } from './ModelsRow'
import { ModelsSelected } from './ModelsSelected'

const SEARCH_DELAY_MS = 250
const PAGE_LIMIT = 24
/** A thumbnail, a name and what the model does: two lines beside a 32 px picture. */
const ROW_HEIGHT = 40

/** Long enough to gather a flick of the scrollbar, short enough to feel immediate. */
const THUMBNAIL_GATHER_MS = 120

/**
 * How many pages the panel pulls on its own before it waits for the user. Not just the empty
 * ones: a filter that matches a handful never fills the viewport either, so the end stays in
 * sight and the list would keep asking until the catalogue ran dry — on open, untouched.
 */
const AUTOMATIC_PULLS = 6

/**
 * Pictures resolved only for the cards that reached the screen. 482 of the 642 public models
 * carry no `thumbnail` and are pictured by one of their example assets instead, whose URL is
 * signed and short-lived — so it is fetched when seen, never with the listing.
 *
 * The ids are gathered before being asked for: scrolling crosses one row at a time, and
 * requesting per row would fire a burst of tiny calls at a single endpoint — the rate-limit
 * trap. One request per pause, and never twice for the same asset.
 */
function useLazyPreviews() {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const asked = useRef(new Set<string>())
  const pending = useRef(new Set<string>())
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  const resolve = useCallback((assetIds: readonly string[]) => {
    for (const id of assetIds) {
      if (!asked.current.has(id)) {
        asked.current.add(id)
        pending.current.add(id)
      }
    }

    if (!pending.current.size || timer.current) return

    timer.current = setTimeout(() => {
      timer.current = null
      // Capped to what the channel accepts; the rest stays pending for the next window.
      const batch = [...pending.current].slice(0, MODEL_IDS_BATCH_LIMIT)
      for (const id of batch) pending.current.delete(id)

      void getBridge()
        ?.scenario.modelPreviews(batch)
        .then(found => setUrls(current => ({ ...current, ...found })))
        .catch(() => {
          // Forgotten, not remembered as done: a batch lost to a dropped connection would
          // otherwise leave those cards on their placeholder until the panel is closed.
          for (const id of batch) asked.current.delete(id)
        })
    }, THUMBNAIL_GATHER_MS)
  }, [])

  return { urls, resolve }
}

/**
 * The model browser. It follows the active workspace — Image shows image models, 3D shows 3D
 * models — because the title bar already says which one is active; type tabs would repeat it.
 */
export function Models() {
  const { t } = useTranslation()
  const workspace = useLayouts(state => state.activeWorkspace)
  const { family } = workspaceById(workspace)

  // Per family: the bar follows the workspace like the rest of this panel, and a filter set
  // under Image narrowing the Skyboxes space is a filter nobody can find to relax.
  const collection = useModels(state => modelCollectionOf(state, family))
  const setCollection = useModels(state => state.setCollection)
  // Through the same answer the rail and the generator read. Reading the session choice alone
  // left this panel saying "no model chosen" about the very model the generator was running.
  const selectedId = useModelForFamily(family)
  const select = useModels(state => state.select)
  const authenticated = useSettings(state => state.auth.authenticated)
  const plan = usePlanAccess()

  const refusalFor = usePlanRefusal(plan)

  // Debounced WITH the family it was typed under, because the two now change independently: the
  // search text used to be shared, so leaving a space never altered it. It does now, and a word
  // left over from the space just left would spend its 250 ms sending the walk down the search
  // endpoint and flashing "no result" over a space nobody had searched.
  const typed = useMemo(() => ({ family, search: collection.search }), [family, collection.search])
  const settled = useDebounced(typed, SEARCH_DELAY_MS)
  const search = settled.family === family ? settled.search : ''
  // No memo, and only for this one: react-query hashes the key structurally, so a fresh object
  // costs nothing, and `queryFrom` translates nothing.
  const query = queryFrom(collection, family, search)

  // Memoised, unlike the query above: building the facets translates up to twenty-five labels
  // through i18next — measured at 376 µs, against 1 µs for the query — and this panel re-renders
  // on every keystroke in its search field.
  const facets = useMemo(() => facetsFor(family, t), [family, t])
  const sorts = useMemo(() => sortOptions(t), [t])

  const catalogue = useInfiniteQuery<ModelPage>({
    queryKey: ['models', query],
    queryFn: ({ pageParam }) =>
      getBridge()?.scenario.searchModels({
        ...query,
        limit: PAGE_LIMIT,
        ...(typeof pageParam === 'string' ? { cursor: pageParam } : {}),
      }) ?? Promise.resolve({ items: [], cursor: null }),
    getNextPageParam: page => page.cursor ?? undefined,
    initialPageParam: undefined,
    enabled: authenticated,
  })

  /**
   * Keyed by id: the walk covers private models then public ones, and a model listed in both
   * would otherwise appear twice — and collide as a React key. The map is kept rather than
   * discarded, so looking the selected model up stays a lookup.
   */
  const byId = useMemo(() => {
    const unique = new Map<string, ModelSummary>()
    for (const page of catalogue.data?.pages ?? []) {
      for (const model of page.items) if (!unique.has(model.id)) unique.set(model.id, model)
    }
    return unique
  }, [catalogue.data])

  const items = useMemo(() => [...byId.values()], [byId])

  const { urls, resolve } = useLazyPreviews()

  const onVisible = useCallback(
    (shown: readonly ModelSummary[]) => {
      const wanted = shown
        .filter(model => !model.thumbnail && model.previewAssetId)
        .map(model => model.previewAssetId ?? '')
      resolve(wanted)
    },
    [resolve],
  )

  /** A model's picture: its own thumbnail when it has one, its example asset otherwise. */
  const pictureOf = useCallback(
    (model: ModelSummary) =>
      model.thumbnail ?? (model.previewAssetId ? urls[model.previewAssetId] : undefined),
    [urls],
  )

  // Depending on the query object itself would rebuild this on every render — react-query
  // hands back a fresh proxy each time — and re-arm the collection's end-of-list effect with it.
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = catalogue
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  /**
   * The registry bounds how many pages one request walks, so a selective filter can answer
   * nothing — or too little to fill the panel — while the catalogue still has more. Nothing
   * scrolls in either case, so the panel asks on its own, up to a ceiling. Past it, the list
   * waits for a scroll, and `onReachEnd` takes over.
   */
  const pulls = useRef(0)
  const queryKey = JSON.stringify(query)
  useEffect(() => {
    pulls.current = 0
  }, [queryKey])

  useEffect(() => {
    if (items.length >= PAGE_LIMIT || !hasNextPage || isFetchingNextPage) return
    if (pulls.current >= AUTOMATIC_PULLS) return

    pulls.current += 1
    void fetchNextPage()
  }, [items.length, hasNextPage, isFetchingNextPage, fetchNextPage])

  const selected = selectedId ? (byId.get(selectedId) ?? null) : null

  if (!authenticated) return <MissingCredentials icon={mdiCubeScan} />

  // Without this the panel sits on "loading" forever when the API refuses the request.
  if (catalogue.isError) {
    return <EmptyState icon={mdiCubeScan} message={t(failureKeyOf(catalogue.error))} />
  }

  return (
    <div className="flex h-full flex-col">
      <ModelsSelected model={selected} picture={selected ? pictureOf(selected) : undefined} />

      <CollectionBar
        state={collection}
        onChange={next => setCollection(family, next)}
        facets={facets}
        sorts={sorts}
      />

      <div className="min-h-0 flex-1">
        <Collection
          label={t('panels.models')}
          items={items}
          state={collection}
          selectedIds={selectedId ? [selectedId] : []}
          onSelect={model => select(model.family, model.id)}
          onReachEnd={loadMore}
          onVisible={onVisible}
          // The same answer greys the cell and explains it, so a row cannot end up dimmed with
          // nothing to say why.
          isDisabled={model => refusalFor(model.requiredPlanLevel) !== undefined}
          rowHeight={ROW_HEIGHT}
          renderCard={model => (
            <ModelsCard
              model={model}
              picture={pictureOf(model)}
              refusal={refusalFor(model.requiredPlanLevel)}
            />
          )}
          renderRow={model => (
            <ModelsRow
              model={model}
              picture={pictureOf(model)}
              refusal={refusalFor(model.requiredPlanLevel)}
            />
          )}
          empty={
            <EmptyState
              icon={mdiCubeScan}
              message={
                catalogue.isFetching
                  ? t('collection.loading')
                  : // The debounced search, not the typed one: for the 250 ms in between, the
                    // filter blamed for the empty panel has not been applied yet.
                    isFiltered(
                        { ...collection, search },
                        facets.map(facet => facet.key),
                      )
                    ? t('collection.noMatch')
                    : t('models.none')
              }
            />
          }
          footer={
            catalogue.isFetchingNextPage ? (
              <p className="text-muted text-tiny py-2 text-center">{t('collection.loading')}</p>
            ) : null
          }
        />
      </div>
    </div>
  )
}

import { mdiCubeScan } from '@mdi/js'
import { useInfiniteQuery } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { MODEL_IDS_BATCH_LIMIT, type ModelPage, type ModelSummary } from '@shared/domain/model'
import { isBeyondPlan } from '@shared/domain/plan'
import { failureKeyOf } from '@/services/failure-message'
import { usePlanAccess } from '@/helpers/plan-access'
import { HINT_LEFT } from '@/helpers/tooltip'
import { cn } from '@/helpers/cn'
import { Collection } from '@/design/Collection'
import { CollectionBar } from '@/design/CollectionBar'
import { isFiltered } from '@/helpers/collection-state'
import { useModelForScope } from '@/helpers/model-for-scope'
import { MediaTile } from '@/design/MediaTile'
import { Thumbnail } from '@/design/Thumbnail'
import { Row } from '@/design/Row'
import { useDebounced } from '@/hooks/useDebounced'
import { getBridge } from '@/services/bridge'
import { useLayouts } from '@/stores/layouts'
import { useModels } from '@/stores/models'
import { useSettings } from '@/stores/settings'
import { workspaceById } from '@/helpers/workspaces'
import { EmptyState } from '@/design/EmptyState'
import { MissingCredentials } from '@/panels/shared/MissingCredentials'
import { facetsFor, queryFrom, sortOptions } from './model-filters'

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
  const { family, scope } = workspaceById(workspace)

  const collection = useModels(state => state.collection)
  const setCollection = useModels(state => state.setCollection)
  // Through the same answer the rail and the generator read. Reading the session choice alone
  // left this panel saying "no model chosen" about the very model the generator was running.
  const selectedId = useModelForScope(scope)
  const select = useModels(state => state.select)
  const authenticated = useSettings(state => state.auth.authenticated)
  const plan = usePlanAccess()

  /**
   * The sentence is the same for every refused model — it names the plan, not the model — so it
   * is translated once per plan rather than once per row. The panel re-renders on each keystroke
   * and on each scroll frame, with up to 36 cells mounted: interpolating it per row put it in
   * the same bracket as `facetsFor` above, which is memoised for exactly that reason.
   */
  const planRefusal = useMemo(
    () => (plan ? t('models.planLockedHint', { plan: plan.name }) : undefined),
    [plan, t],
  )

  /**
   * Why a model is refused, or `undefined` when it is not. The greying and the sentence read the
   * same predicate, so a row cannot end up dimmed with nothing to explain it.
   */
  const refusalOf = useCallback(
    (model: ModelSummary): string | undefined =>
      isBeyondPlan(model.requiredPlanLevel, plan) ? planRefusal : undefined,
    [plan, planRefusal],
  )

  const search = useDebounced(collection.search, SEARCH_DELAY_MS)
  // No memo, and only for this one: react-query hashes the key structurally, so a fresh object
  // costs nothing, and `queryFrom` translates nothing.
  const query = queryFrom(collection, family, search)

  // Memoised, unlike the query above: the two share a signature and nothing else. Building the
  // facets translates up to twenty-five labels through i18next — measured at 376 µs where the
  // surface has no family of its own and one is picked, against 1 µs for the query — and this
  // panel re-renders on every keystroke in its search field.
  // The family is read again inside rather than closed over: a value destructured off a record
  // is one the compiler rule will not accept as a dependency, and the workspace it comes from is.
  const facets = useMemo(
    () => facetsFor(collection, workspaceById(workspace).family, t),
    [collection, workspace, t],
  )
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
      <SelectedModel model={selected} picture={selected ? pictureOf(selected) : undefined} />

      <CollectionBar state={collection} onChange={setCollection} facets={facets} sorts={sorts} />

      <div className="min-h-0 flex-1">
        <Collection
          label={t('panels.models')}
          items={items}
          state={collection}
          selectedIds={selectedId ? [selectedId] : []}
          onSelect={model => select(scope, model.id, model.family)}
          onReachEnd={loadMore}
          onVisible={onVisible}
          // The predicate directly, not `refusalOf`: this runs for every mounted cell and has no
          // use for the sentence it would build.
          isDisabled={model => isBeyondPlan(model.requiredPlanLevel, plan)}
          rowHeight={ROW_HEIGHT}
          renderCard={model => (
            <ModelCard model={model} picture={pictureOf(model)} refusal={refusalOf(model)} />
          )}
          renderRow={model => (
            <ModelRow model={model} picture={pictureOf(model)} refusal={refusalOf(model)} />
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

/**
 * What the API actually says about a model, in one line: who published it and what it does.
 * Rating, generation time and category come back empty on all 642 public models — measured.
 *
 * "Featured" outranks the origin: a third-party model Scenario highlights reads as vetted,
 * whereas calling GPT Image 2 "community" says the opposite of what the tag means.
 */
function subtitleOf(model: ModelSummary, t: TFunction): string {
  const standing = model.featured
    ? t('models.featured')
    : t(model.origin === 'official' ? 'models.official' : 'models.community')
  const [capability] = model.capabilities

  // An unknown capability shows its API name rather than its missing translation key.
  return capability
    ? `${standing} · ${t(`capabilities.${capability}`, { defaultValue: capability })}`
    : standing
}

/** The chosen model, kept in view: it is what the generator below will run. */
function SelectedModel({ model, picture }: { model: ModelSummary | null; picture?: string }) {
  const { t } = useTranslation()

  // Height stated rather than grown into: `Row` sizes itself against its parent, and 56 px is
  // what this header measured when it was written by hand. The bottom border eats a pixel of it.
  return (
    <div className="border-border h-14 border-b px-1 py-1.5">
      <Row
        media={<Thumbnail url={picture} className="size-10" />}
        title={model?.name ?? t('models.noSelection')}
        subtitle={model ? t(`families.${model.family}`) : t('models.pickOne')}
      />
    </div>
  )
}

/** The tile's corner label: a standing, or the reason the model cannot be picked. */
const BADGE = cn(
  'bg-chassis/75 text-text absolute top-1 right-1 max-w-[calc(100%-0.5rem)]',
  'truncate rounded-(--radius-sc-sm) px-1 py-px text-micro leading-tight',
)

/**
 * The tile's corner label. The refusal outranks "featured": a highlighted model the plan will
 * not run is first of all one that cannot be picked, and the tile has room for one label.
 */
function badgeFor(model: ModelSummary, refusal: string | undefined, t: TFunction): ReactNode {
  // Left, not right: the badge already sits against the tile's right edge, and this panel is
  // docked to a side — a tooltip opening outward would leave the window. HINT and not TIP:
  // the badge's own words are on screen, so this explains them instead of repeating them.
  if (refusal) {
    return (
      <span {...HINT_LEFT(refusal)} className={BADGE}>
        {t('models.planLocked')}
      </span>
    )
  }

  if (!model.featured) return null

  return (
    <span title={t('models.featured')} className={BADGE}>
      {t('models.featured')}
    </span>
  )
}

const ModelCard = memo(function ModelCard({
  model,
  picture,
  refusal,
}: {
  model: ModelSummary
  picture?: string
  refusal?: string
}) {
  const { t } = useTranslation()

  return <MediaTile url={picture} caption={model.name} badge={badgeFor(model, refusal, t)} />
})

/** Memoized like the card: a scroll re-renders every mounted row on each frame. */
const ModelRow = memo(function ModelRow({
  model,
  picture,
  refusal,
}: {
  model: ModelSummary
  picture?: string
  refusal?: string
}) {
  const { t } = useTranslation()

  return (
    <Row
      media={<Thumbnail url={picture} className="size-8" />}
      title={model.name}
      // The subtitle says what the model IS; the refusal says why it is out of reach, and it
      // replaces the standing rather than crowding a 10px line with both.
      subtitle={refusal ? t('models.planLocked') : subtitleOf(model, t)}
      hint={refusal}
    />
  )
})

import { mdiCubeScan } from '@mdi/js'
import { useInfiniteQuery } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MODEL_IDS_BATCH_LIMIT, type ModelPage, type ModelSummary } from '@shared/domain/model'
import { failureKeyOf } from '@/services/failure-message'
import { cn } from '@/helpers/cn'
import { Collection } from '@/design/Collection'
import { CollectionBar } from '@/design/CollectionBar'
import { isFiltered } from '@/helpers/collection-state'
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
  const selectedId = useModels(state => state.selected[scope] ?? null)
  const select = useModels(state => state.select)
  const authenticated = useSettings(state => state.auth.authenticated)

  const search = useDebounced(collection.search, SEARCH_DELAY_MS)
  // No memo: react-query hashes the key structurally, so a fresh object costs nothing.
  const query = queryFrom(collection, family, search)
  const facets = facetsFor(family, t)
  const sorts = sortOptions(t)

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
          onSelect={model => select(scope, model.id)}
          onReachEnd={loadMore}
          onVisible={onVisible}
          rowHeight={ROW_HEIGHT}
          renderCard={model => <ModelCard model={model} picture={pictureOf(model)} />}
          renderRow={model => <ModelRow model={model} picture={pictureOf(model)} />}
          empty={
            <EmptyState
              icon={mdiCubeScan}
              message={
                catalogue.isFetching
                  ? t('collection.loading')
                  : // The debounced search, not the typed one: for the 250 ms in between, the
                    // filter blamed for the empty panel has not been applied yet.
                    isFiltered({ ...collection, search })
                    ? t('collection.noMatch')
                    : t('models.none')
              }
            />
          }
          footer={
            catalogue.isFetchingNextPage ? (
              <p className="text-muted py-2 text-center text-[11px]">{t('collection.loading')}</p>
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

const ModelCard = memo(function ModelCard({
  model,
  picture,
}: {
  model: ModelSummary
  picture?: string
}) {
  const { t } = useTranslation()

  return (
    <MediaTile
      url={picture}
      caption={model.name}
      badge={
        model.featured && (
          <span
            title={t('models.featured')}
            className={cn(
              'bg-chassis/75 text-text absolute top-1 right-1 max-w-[calc(100%-0.5rem)]',
              'truncate rounded-(--radius-sc-sm) px-1 py-px text-[9px] leading-tight',
            )}
          >
            {t('models.featured')}
          </span>
        )
      }
    />
  )
})

/** Memoized like the card: a scroll re-renders every mounted row on each frame. */
const ModelRow = memo(function ModelRow({
  model,
  picture,
}: {
  model: ModelSummary
  picture?: string
}) {
  const { t } = useTranslation()

  return (
    <Row
      media={<Thumbnail url={picture} className="size-8" />}
      title={model.name}
      subtitle={subtitleOf(model, t)}
    />
  )
})

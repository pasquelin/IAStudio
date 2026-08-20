import { mdiCubeScan } from '@mdi/js'
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { ModelSummary } from '@shared/domain/model'
import { failureKeyOf } from '@/services/failureMessage'
import { Collection } from '@/design/Collection/Collection'
import { CollectionBar } from '@/design/CollectionBar/CollectionBar'
import { QuietNote } from '@/design/QuietNote'
import { isFiltered } from '@/helpers/collectionState'
import { useDebounced, SEARCH_DELAY_MS } from '@/hooks/useDebounced'
import { useLazyPreviews } from '@/hooks/useLazyPreviews'
import { usePages } from '@/hooks/usePages'
import { useModelForFamily } from '@/hooks/useModelForFamily'
import { usePlanAccess } from '@/hooks/usePlanAccess'
import { usePlanRefusal } from '@/hooks/usePlanRefusal'
import { getBridge } from '@/services/bridge'
import { useLayouts } from '@/stores/layouts'
import { modelCollectionOf, useModels } from '@/stores/models'
import { useSettings } from '@/stores/settings'
import { workspaceById } from '@/helpers/workspaces'
import { EmptyState } from '@/design/EmptyState'
import { MissingCredentials } from '@/panels/shared/MissingCredentials'
import { facetsFor, queryFrom, sortOptions } from '../modelFilters'
import { ModelsCard } from './ModelsCard'
import { ModelsRow } from './ModelsRow'
import { ModelsSelected } from './ModelsSelected'

const PAGE_LIMIT = 24
/** A thumbnail, a name and what the model does: two lines beside a 32 px picture. */
const ROW_HEIGHT = 40

/**
 * How many pages the panel pulls on its own before it waits for the user. Not just the empty
 * ones: a filter that matches a handful never fills the viewport either, so the end stays in
 * sight and the list would keep asking until the catalogue ran dry — on open, untouched.
 */
const AUTOMATIC_PULLS = 6

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

  // The walk covers private models then public ones, and a model listed in both would otherwise
  // appear twice — and collide as a React key. `usePages` holds a listing to one row per id.
  // The registry bounds how many pages one request walks, so a selective filter can answer
  // nothing — or too little to fill the panel — while the catalogue still has more.
  const catalogue = usePages(
    ['models', query],
    from => getBridge()?.provider.searchModels({ ...query, limit: PAGE_LIMIT, ...from }),
    {
      enabled: authenticated,
      fill: { wanted: PAGE_LIMIT, max: AUTOMATIC_PULLS },
      // The walk lists the private models then the public ones, and one can be in both: a run of
      // pages this panel has already shown is ordinary here, and is not the end of the catalogue.
      endsOnRepeats: false,
    },
  )
  const items = catalogue.items

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

  const selected = selectedId ? (catalogue.byId.get(selectedId) ?? null) : null

  if (!authenticated) return <MissingCredentials icon={mdiCubeScan} />

  // Without this the panel sits on "loading" forever when the API refuses the request.
  if (catalogue.refusal !== null) {
    return <EmptyState icon={mdiCubeScan} message={t(failureKeyOf(catalogue.refusal))} />
  }

  return (
    <div className="flex h-full flex-col">
      <ModelsSelected model={selected} picture={selected ? pictureOf(selected) : undefined} />

      <CollectionBar
        scId="models"
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
          onReachEnd={catalogue.more}
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
                catalogue.fetching
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
            catalogue.fetchingMore ? (
              // Not `standalone`: its `py-6` is the room an empty list gives a sentence, and this
              // one sits under a full grid that is still paging.
              <div className="py-2 text-center">
                <QuietNote>{t('collection.loading')}</QuietNote>
              </div>
            ) : null
          }
        />
      </div>
    </div>
  )
}

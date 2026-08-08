import { mdiImageMultipleOutline } from '@mdi/js'
import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { assetBadgeOf } from '@shared/domain/asset'
import { useToolLying } from '@/app/tool-zone'
import { Collection } from '@/design/Collection'
import { CollectionBar } from '@/design/CollectionBar'
import { EmptyState } from '@/design/EmptyState'
import { LIST_ROW_HEIGHT } from '@/design/styles'
import { filterLocally, isFiltered } from '@/helpers/collection-state'
import { assetTypesOf } from '@/helpers/workspaces'
import { useAssets } from '@/stores/assets'
import { useLayouts } from '@/stores/layouts'
import { useProject } from '@/stores/project'
import { activeOwnerId, useSettings } from '@/stores/settings'
import { AssetCard } from './AssetCard'
import { AssetRow } from './AssetRow'
import { ImportProgress } from './ImportProgress'
import { useAssetFacets } from './facets'
import { LOCATION_FACET, useBadgeLabels } from './location-facet'
import { TYPE_FACET, useTypeLabels } from './type-facet'

/**
 * Asset library, standing where an Unreal content browser would. Both views are virtualized
 * by `Collection`; the filtering is local because the whole project catalogue is already in
 * memory — unlike the model panel, which pages against the API.
 */
export function AssetBrowser() {
  const { t } = useTranslation()
  const items = useAssets(state => state.items)
  const collection = useAssets(state => state.collection)
  const setCollection = useAssets(state => state.setCollection)
  const project = useProject(state => state.project)
  const workspace = useLayouts(state => state.activeWorkspace)
  const ownerId = useSettings(activeOwnerId)
  const typeLabels = useTypeLabels()
  const badgeLabels = useBadgeLabels()
  const facets = useAssetFacets(typeLabels)
  const lying = useToolLying()
  const setScope = useAssets(state => state.setScope)

  /**
   * What the space in front can actually take — a default, and one the user can step out of.
   *
   * Asked OF the catalogue rather than filtered out of its answer: the count in the header and
   * the "this project has no asset" message both read the same list, and a shelf that dropped
   * rows behind their backs would leave them describing a project nobody is looking at.
   *
   * Naming a kind switches the scope off entirely. Otherwise choosing "video" while painting
   * would answer nothing at all — two filters intersecting reads as broken, not as a scope.
   */
  const chosenType = Boolean(collection.selections[TYPE_FACET]?.length)
  useEffect(() => {
    setScope(chosenType ? null : assetTypesOf(workspace))
  }, [setScope, chosenType, workspace])

  const shown = useMemo(
    () =>
      filterLocally(items, collection, {
        text: asset => asset.name,
        facets: {
          [TYPE_FACET]: asset => [asset.type],
          // Narrowed by what the badge says, so the filter and the mark beside it agree.
          [LOCATION_FACET]: asset => [assetBadgeOf(asset, ownerId)],
        },
      }),
    [items, collection, ownerId],
  )

  // An empty project and no project at all are different situations, and the user can only
  // act on one of them.
  const emptyMessage = isFiltered(collection)
    ? t('collection.noMatch')
    : project
      ? t('assets.none')
      : t('assets.openProject')

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* In a band the bar rides on the title row instead — see `AssetBrowserActions`. */}
      {!lying && <CollectionBar state={collection} onChange={setCollection} facets={facets} />}
      <ImportProgress />
      <Collection
        items={shown}
        state={collection}
        rowHeight={LIST_ROW_HEIGHT}
        renderCard={asset => (
          <AssetCard asset={asset} ownerId={ownerId} badgeLabels={badgeLabels} />
        )}
        renderRow={asset => (
          <AssetRow
            asset={asset}
            typeLabel={typeLabels.get(asset.type) ?? asset.type}
            ownerId={ownerId}
            badgeLabels={badgeLabels}
          />
        )}
        empty={<EmptyState icon={mdiImageMultipleOutline} message={emptyMessage} />}
      />
    </div>
  )
}

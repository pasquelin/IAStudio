import { mdiImageMultipleOutline } from '@mdi/js'
import { useMemo } from 'react'
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
import { LOCATION_FACET, useLocationFacet } from './location-facet'
import { TYPE_FACET, useTypeFacet, useTypeLabels } from './type-facet'

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
  const typeFacet = useTypeFacet(typeLabels)
  const locationFacet = useLocationFacet()
  const lying = useToolLying()

  const facets = useMemo(() => [...typeFacet, ...locationFacet], [typeFacet, locationFacet])

  /**
   * What the space in front can actually take — a default, and one the user can step out of.
   *
   * Asking for a kind by name switches it off entirely. Otherwise choosing "video" while
   * painting would answer nothing at all: the shelf would be filtering on two things at once
   * and showing the intersection, which reads as a broken filter rather than as a scope.
   */
  const chosenType = collection.selections[TYPE_FACET]?.length
  const usable = useMemo(
    () => (chosenType ? null : new Set(assetTypesOf(workspace))),
    [workspace, chosenType],
  )

  const shown = useMemo(
    () =>
      filterLocally(usable ? items.filter(asset => usable.has(asset.type)) : items, collection, {
        text: asset => asset.name,
        facets: {
          [TYPE_FACET]: asset => [asset.type],
          // Narrowed by what the badge says, so the filter and the mark beside it agree.
          [LOCATION_FACET]: asset => [assetBadgeOf(asset, ownerId)],
        },
      }),
    [items, collection, usable, ownerId],
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
        renderCard={asset => <AssetCard asset={asset} ownerId={ownerId} />}
        renderRow={asset => (
          <AssetRow
            asset={asset}
            typeLabel={typeLabels.get(asset.type) ?? asset.type}
            ownerId={ownerId}
          />
        )}
        empty={<EmptyState icon={mdiImageMultipleOutline} message={emptyMessage} />}
      />
    </div>
  )
}

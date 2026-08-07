import { mdiImageMultipleOutline } from '@mdi/js'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ASSET_TYPES, type AssetType } from '@shared/domain/asset'
import { useToolLying } from '@/app/tool-zone'
import { Collection } from '@/design/Collection'
import { CollectionBar } from '@/design/CollectionBar'
import { EmptyState } from '@/design/EmptyState'
import { LIST_ROW_HEIGHT } from '@/design/styles'
import { filterLocally, isFiltered, type FacetDescriptor } from '@/helpers/collection-state'
import { useAssets } from '@/stores/assets'
import { useProject } from '@/stores/project'
import { AssetCard } from './AssetCard'
import { AssetRow } from './AssetRow'
import { ImportProgress } from './ImportProgress'

const TYPE_FACET = 'type'

/**
 * Six constant strings, resolved once for the whole panel. A row is remounted by the hundred
 * while scrolling, so translating inside one would run i18next per row and per frame.
 */
function useTypeLabels(): Map<AssetType, string> {
  const { t } = useTranslation()

  return useMemo(() => new Map(ASSET_TYPES.map(value => [value, t(`assetTypes.${value}`)])), [t])
}

function useTypeFacet(labels: Map<AssetType, string>): FacetDescriptor[] {
  const { t } = useTranslation()

  return useMemo(
    () => [
      {
        key: TYPE_FACET,
        label: t('assets.type'),
        options: ASSET_TYPES.map(value => ({ value, label: labels.get(value) ?? value })),
      },
    ],
    [t, labels],
  )
}

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
  const typeLabels = useTypeLabels()
  const facets = useTypeFacet(typeLabels)
  const lying = useToolLying()

  const shown = useMemo(
    () =>
      filterLocally(items, collection, {
        text: asset => asset.name,
        facets: { [TYPE_FACET]: asset => [asset.type] },
      }),
    [items, collection],
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
      {/* Laid out along the bar in the bottom strip, stacked in a side column: this shelf now
          appears in both, and stacking across the window strands one dropdown at full width. */}
      <CollectionBar
        state={collection}
        onChange={setCollection}
        facets={facets}
        layout={lying ? 'inline' : 'stacked'}
      />
      <ImportProgress />
      <Collection
        items={shown}
        state={collection}
        rowHeight={LIST_ROW_HEIGHT}
        renderCard={asset => <AssetCard asset={asset} />}
        renderRow={asset => (
          <AssetRow asset={asset} typeLabel={typeLabels.get(asset.type) ?? asset.type} />
        )}
        empty={<EmptyState icon={mdiImageMultipleOutline} message={emptyMessage} />}
      />
    </div>
  )
}

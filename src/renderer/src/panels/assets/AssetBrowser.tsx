import { mdiImageMultipleOutline } from '@mdi/js'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useToolLying } from '@/app/tool-zone'
import { Collection } from '@/design/Collection'
import { CollectionBar } from '@/design/CollectionBar'
import { EmptyState } from '@/design/EmptyState'
import { LIST_ROW_HEIGHT } from '@/design/styles'
import { filterLocally, isFiltered } from '@/helpers/collection-state'
import { useAssets } from '@/stores/assets'
import { useProject } from '@/stores/project'
import { AssetCard } from './AssetCard'
import { AssetRow } from './AssetRow'
import { ImportProgress } from './ImportProgress'
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
      {/* In a band the bar is drawn on the title row instead — see `AssetBrowserActions`: a
          second row there would cost a tenth of a short zone's height. */}
      {!lying && <CollectionBar state={collection} onChange={setCollection} facets={facets} />}
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

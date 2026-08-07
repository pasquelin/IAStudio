import { mdiFileImportOutline, mdiImageMultipleOutline } from '@mdi/js'
import { memo, useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ASSET_TYPES, posterUrl, type Asset, type AssetType } from '@shared/domain/asset'
import { Collection } from '@/design/Collection'
import { CollectionBar } from '@/design/CollectionBar'
import { startAssetDrag } from '@/helpers/asset-drag'
import { filterLocally, isFiltered, type FacetDescriptor } from '@/helpers/collection-state'
import { MediaTile } from '@/design/MediaTile'
import { Row } from '@/design/Row'
import { LIST_ROW_HEIGHT } from '@/design/styles'
import { ToolButton } from '@/design/ToolButton'
import { useAssets } from '@/stores/assets'
import { useMedia } from '@/stores/media'
import { useProject } from '@/stores/project'
import { assetIcon } from '@/helpers/workspaces'
import { openAsset } from '@/helpers/open-asset'
import { useSelection } from '@/stores/selection'
import { EmptyState } from '@/design/EmptyState'
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

// Only what fits: 500 px of browser bar in this 320 px column header pushed the panel's own
// close button out of the frame, so the bar sits under the title — as the model panel's does.
export function AssetBrowserActions() {
  const { t } = useTranslation()
  const count = useAssets(state => state.items.length)
  // A file cannot be linked into a catalogue that is not open.
  const project = useProject(state => state.project)
  const importMedia = useMedia(state => state.importMedia)

  return (
    <>
      <span className="text-muted mr-1 text-[11px]">{t('assets.count', { count })}</span>
      <ToolButton
        icon={mdiFileImportOutline}
        label={t('assets.import')}
        description={t('assets.importHint')}
        variant="header"
        disabled={!project}
        onClick={() => void importMedia()}
      />
    </>
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
      <CollectionBar state={collection} onChange={setCollection} facets={facets} />
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

/**
 * Wraps whatever the collection renders, so both views drag, select and open the same way.
 *
 * Double-click opens as well as drags: the shelf shares the screen with the montage, so a take
 * can be dragged onto a track — but reaching for one across the window is not always the gesture.
 */
function Draggable({
  asset,
  className,
  children,
}: {
  asset: Asset
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={className}
      draggable
      onPointerDown={() => useSelection.getState().selectAssets([asset.id])}
      onDragStart={event => startAssetDrag(event, asset.id)}
      onDoubleClick={() => openAsset(asset)}
    >
      {children}
    </div>
  )
}

const AssetCard = memo(function AssetCard({ asset }: { asset: Asset }) {
  return (
    <Draggable asset={asset}>
      <MediaTile
        url={posterUrl(asset) ?? undefined}
        caption={asset.name}
        fallbackIcon={assetIcon(asset.type)}
      />
    </Draggable>
  )
})

// The type ends the line rather than sitting under the name: a subtitle would stack two lines
// into the 28 px this shelf gives a row, and `Row` is never told to size itself down.
const AssetRow = memo(function AssetRow({ asset, typeLabel }: { asset: Asset; typeLabel: string }) {
  return (
    // `h-full` on the wrapper: `Row` sizes itself against its parent, which is this div.
    <Draggable asset={asset} className="h-full">
      <Row
        title={asset.name}
        actions={<span className="text-muted shrink-0 text-[11px]">{typeLabel}</span>}
      />
    </Draggable>
  )
})

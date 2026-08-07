import { mdiImageMultipleOutline } from '@mdi/js'
import { memo, useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ASSET_TYPES, assetUrl, type Asset, type AssetType } from '@shared/domain/asset'
import { Collection } from '@/design/Collection'
import { CollectionBar } from '@/design/CollectionBar'
import { startAssetDrag } from '@/helpers/asset-drag'
import { filterLocally, isFiltered, type FacetDescriptor } from '@/helpers/collection-state'
import { MediaTile } from '@/design/MediaTile'
import { Row } from '@/design/Row'
import { useAssets } from '@/stores/assets'
import { useProject } from '@/stores/project'
import { EmptyState } from '@/design/EmptyState'

const TYPE_FACET = 'type'

/** Matches the `--sc-control` gauge the rows are built on, at its tallest (comfortable). */
const ROW_HEIGHT = 28

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
 * The whole browser bar, rendered in the panel's title row rather than under it. The asset
 * dock is a shelf: a second row of controls would take from the only thing it is there to
 * show. Content browsers put search, filters and view options on the title line for that
 * reason, and the header already lays its children out from the right.
 */
export function AssetBrowserActions() {
  const { t } = useTranslation()
  const count = useAssets(state => state.items.length)
  const collection = useAssets(state => state.collection)
  const setCollection = useAssets(state => state.setCollection)
  const facets = useTypeFacet(useTypeLabels())

  return (
    <>
      <span className="text-muted mr-1 text-[11px]">{t('assets.count', { count })}</span>
      <CollectionBar
        state={collection}
        onChange={setCollection}
        facets={facets}
        layout="inline"
        className="border-b-0 p-0"
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
  const project = useProject(state => state.project)
  const typeLabels = useTypeLabels()

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

  // The bar lives in the title row — see `AssetBrowserActions`.
  return (
    <Collection
      items={shown}
      state={collection}
      rowHeight={ROW_HEIGHT}
      renderCard={asset => <AssetCard asset={asset} />}
      renderRow={asset => (
        <AssetRow asset={asset} typeLabel={typeLabels.get(asset.type) ?? asset.type} />
      )}
      empty={<EmptyState icon={mdiImageMultipleOutline} message={emptyMessage} />}
    />
  )
}

/**
 * A local file is served over `scenario://`. The URL is derived from the identifier, not asked
 * for: the renderer still never handles a file path, and a grid of thumbnails costs no IPC.
 */
function preview(asset: Asset): string | undefined {
  const showable = asset.type === 'image' && asset.location === 'local' && asset.path
  return showable ? assetUrl(asset.id) : undefined
}

/** Wraps whatever the collection renders, so both views drag the same way. */
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
    <div className={className} draggable onDragStart={event => startAssetDrag(event, asset.id)}>
      {children}
    </div>
  )
}

const AssetCard = memo(function AssetCard({ asset }: { asset: Asset }) {
  return (
    <Draggable asset={asset}>
      <MediaTile url={preview(asset)} caption={asset.name} />
    </Draggable>
  )
})

/**
 * Memoized, and given its label rather than translating it: a scroll re-renders every mounted
 * row on each frame, and only the handful that actually changed should pay for it.
 *
 * `h-full` on the wrapper too — `Row` sizes itself against its parent, and the drag wrapper
 * would otherwise collapse it to its content.
 */
const AssetRow = memo(function AssetRow({ asset, typeLabel }: { asset: Asset; typeLabel: string }) {
  return (
    <Draggable asset={asset} className="h-full">
      <Row title={asset.name} subtitle={typeLabel} />
    </Draggable>
  )
})

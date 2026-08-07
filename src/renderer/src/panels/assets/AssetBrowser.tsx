import { mdiFileImportOutline, mdiImageMultipleOutline } from '@mdi/js'
import { useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ASSET_TYPES, assetUrl, type Asset } from '@shared/domain/asset'
import { Collection } from '@/design/Collection'
import { CollectionBar } from '@/design/CollectionBar'
import { startAssetDrag } from '@/helpers/asset-drag'
import { filterLocally, isFiltered, type FacetDescriptor } from '@/helpers/collection-state'
import { MediaTile } from '@/design/MediaTile'
import { ToolButton } from '@/design/ToolButton'
import { useAssets } from '@/stores/assets'
import { useMedia } from '@/stores/media'
import { useProject } from '@/stores/project'
import { EmptyState } from '@/design/EmptyState'
import { ImportProgress } from './ImportProgress'

const TYPE_FACET = 'type'

/** Matches the `--sc-control` gauge the rows are built on, at its tallest (comfortable). */
const ROW_HEIGHT = 28

function useTypeFacet(): FacetDescriptor[] {
  const { t } = useTranslation()

  return useMemo(
    () => [
      {
        key: TYPE_FACET,
        label: t('assets.type'),
        options: ASSET_TYPES.map(value => ({ value, label: t(`assetTypes.${value}`) })),
      },
    ],
    [t],
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
  const facets = useTypeFacet()
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
    <div className="flex h-full min-h-0 flex-col">
      <ImportProgress />
      <Collection
        items={shown}
        state={collection}
        rowHeight={ROW_HEIGHT}
        renderCard={asset => <AssetCard asset={asset} />}
        renderRow={asset => <AssetRow asset={asset} />}
        empty={<EmptyState icon={mdiImageMultipleOutline} message={emptyMessage} />}
      />
    </div>
  )
}

/**
 * A local file is served over `scenario://`. The URL is derived from the identifier, not asked
 * for: the renderer still never handles a file path, and a grid of thumbnails costs no IPC.
 */
function preview(asset: Asset): string | undefined {
  // `sourcePath` counts as much as `path`: an imported still is linked where it lies, never
  // copied into the project, and it has a thumbnail all the same.
  const onDisk = asset.path ?? asset.sourcePath
  return asset.type === 'image' && asset.location === 'local' && onDisk
    ? assetUrl(asset.id)
    : undefined
}

/** Wraps whatever the collection renders, so both views drag the same way. */
function Draggable({ asset, children }: { asset: Asset; children: ReactNode }) {
  return (
    <div draggable onDragStart={event => startAssetDrag(event, asset.id)}>
      {children}
    </div>
  )
}

function AssetCard({ asset }: { asset: Asset }) {
  return (
    <Draggable asset={asset}>
      <MediaTile url={preview(asset)} caption={asset.name} />
    </Draggable>
  )
}

function AssetRow({ asset }: { asset: Asset }) {
  return (
    <Draggable asset={asset}>
      <div className="flex h-(--sc-control) items-center gap-2 px-2 text-[12px]">
        <span className="truncate">{asset.name}</span>
        <span className="text-muted ml-auto shrink-0 text-[11px]">{asset.type}</span>
      </div>
    </Draggable>
  )
}

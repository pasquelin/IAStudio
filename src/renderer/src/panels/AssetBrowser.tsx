import { mdiFormatListBulleted, mdiImageMultipleOutline, mdiViewGridOutline } from '@mdi/js'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { assetUrl, type Asset } from '@shared/domain/asset'
import { cn } from '@/design/cn'
import { TIP_BOTTOM } from '@/design/tooltip'
import { ToolButton } from '@/design/ToolButton'
import { useAssets } from '@/stores/assets'
import { useProject } from '@/stores/project'
import { EmptyState } from './EmptyState'

const THUMBNAIL_SIZE = 96
const ROW_HEIGHT = 26

/** Actions rendered in the panel's title bar, on the same line as its name. */
export function AssetBrowserActions() {
  const { t } = useTranslation()
  const view = useAssets(state => state.view)
  const setView = useAssets(state => state.setView)
  const count = useAssets(state => state.items.length)

  return (
    <>
      <span className="text-muted mr-1 text-[11px]">{t('assets.count', { count })}</span>
      <ToolButton
        icon={mdiViewGridOutline}
        label={t('assets.gridView')}
        tooltip={TIP_BOTTOM}
        variant="header"
        active={view === 'grid'}
        onClick={() => setView('grid')}
      />
      <ToolButton
        icon={mdiFormatListBulleted}
        label={t('assets.listView')}
        tooltip={TIP_BOTTOM}
        variant="header"
        active={view === 'list'}
        onClick={() => setView('list')}
      />
    </>
  )
}

/**
 * Asset library, standing where an Unreal content browser would: bottom strip, two views.
 * The list is virtualized; the grid is not yet — it will have to be before a well-stocked
 * project, which holds thousands of thumbnails, is loaded into it.
 */
export function AssetBrowser() {
  const { t } = useTranslation()
  const view = useAssets(state => state.view)
  const items = useAssets(state => state.items)
  const project = useProject(state => state.project)
  const scroller = useRef<HTMLDivElement>(null)

  if (items.length === 0) {
    // An empty project and no project at all are different situations, and the user can only
    // act on one of them.
    const message = project ? t('assets.none') : t('assets.openProject')
    return <EmptyState icon={mdiImageMultipleOutline} message={message} />
  }

  return (
    <div ref={scroller} className="h-full overflow-auto p-2">
      {view === 'grid' ? (
        <AssetsGrid assets={items} />
      ) : (
        <AssetsList assets={items} container={scroller} />
      )}
    </div>
  )
}

const FRAME = 'border-border bg-surface aspect-square rounded-(--radius-sc-sm) border'

/**
 * A local file is served over `scenario://`. The URL is derived from the identifier, not asked
 * for: the renderer still never handles a file path, and a grid of thumbnails costs no IPC.
 */
function Thumbnail({ asset }: { asset: Asset }) {
  if (asset.type !== 'image' || asset.location !== 'local' || !asset.path) {
    return <div className={FRAME} />
  }

  return (
    <img src={assetUrl(asset.id)} alt="" loading="lazy" className={cn(FRAME, 'object-cover')} />
  )
}

function AssetsGrid({ assets }: { assets: Asset[] }) {
  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${THUMBNAIL_SIZE}px, 1fr))` }}
    >
      {assets.map(asset => (
        <figure key={asset.id} className="m-0 flex flex-col gap-1">
          <Thumbnail asset={asset} />
          <figcaption className="text-muted truncate text-[11px]">{asset.name}</figcaption>
        </figure>
      ))}
    </div>
  )
}

function AssetsList({
  assets,
  container,
}: {
  assets: Asset[]
  container: RefObject<HTMLDivElement | null>
}) {
  const virtualizer = useVirtualizer({
    count: assets.length,
    getScrollElement: () => container.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  })

  return (
    <div style={{ height: virtualizer.getTotalSize() }} className="relative">
      {virtualizer.getVirtualItems().map(row => {
        const asset = assets[row.index]
        if (!asset) return null
        return (
          <div
            key={asset.id}
            style={{ transform: `translateY(${row.start}px)`, height: row.size }}
            className={cn(
              'absolute inset-x-0 top-0 flex items-center gap-2 rounded-(--radius-sc-sm) px-2',
              'hover:bg-surface text-[12px]',
            )}
          >
            <span className="truncate">{asset.name}</span>
            <span className="text-muted ml-auto shrink-0 text-[11px]">{asset.type}</span>
          </div>
        )
      })}
    </div>
  )
}

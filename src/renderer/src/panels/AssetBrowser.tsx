import { mdiFormatListBulleted, mdiImageMultipleOutline, mdiViewGridOutline } from '@mdi/js'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useEffect, useRef, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import type { Asset } from '@shared/domain/asset'
import { cn } from '@/design/cn'
import { TIP_BOTTOM } from '@/design/tooltip'
import { ToolButton } from '@/design/ToolButton'
import { useAssets } from '@/stores/assets'
import { EmptyState } from './EmptyState'

const THUMBNAIL_SIZE = 96
const ROW_HEIGHT = 26

export type AssetBrowserProps = {
  assets?: Asset[]
}

/** Actions rendered in the panel's title bar, on the same line as its name. */
export function AssetBrowserActions({ assets }: AssetBrowserProps) {
  const { t } = useTranslation()
  const view = useAssets(state => state.view)
  const setView = useAssets(state => state.setView)
  const items = useAssets(state => state.items)
  const shown = assets ?? items

  return (
    <>
      <span className="text-muted mr-1 text-[11px]">
        {t('assets.count', { count: shown.length })}
      </span>
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
export function AssetBrowser({ assets }: AssetBrowserProps) {
  const { t } = useTranslation()
  const view = useAssets(state => state.view)
  const items = useAssets(state => state.items)
  const scroller = useRef<HTMLDivElement>(null)

  const shown = assets ?? items

  if (shown.length === 0) {
    return <EmptyState icon={mdiImageMultipleOutline} message={t('assets.none')} />
  }

  return (
    <div ref={scroller} className="h-full overflow-auto p-2">
      {view === 'grid' ? (
        <AssetsGrid assets={shown} />
      ) : (
        <AssetsList assets={shown} container={scroller} />
      )}
    </div>
  )
}

/**
 * A local file is served over `scenario://`, resolved on demand. The renderer asks for an
 * identifier's URL; it never handles a file path — see spec § 3.4.
 */
function Thumbnail({ asset }: { asset: Asset }) {
  const url = useAssets(state => state.urls[asset.id])
  const resolveUrl = useAssets(state => state.resolveUrl)

  useEffect(() => {
    void resolveUrl(asset.id)
  }, [asset.id, resolveUrl])

  const frame = 'border-border bg-surface aspect-square rounded-(--radius-sc-sm) border'

  if (!url || asset.type !== 'image') return <div className={frame} />

  return <img src={url} alt="" loading="lazy" className={cn(frame, 'object-cover')} />
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

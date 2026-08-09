import { useCallback, useState, type ReactNode } from 'react'
import type { Asset } from '@shared/domain/asset'
import { startAssetDrag } from '@/helpers/asset-drag'
import { useSelection } from '@/stores/selection'
import { AssetMenu } from './AssetMenu'

export type DraggableAssetProps = {
  asset: Asset
  className?: string
  children: ReactNode
}

/**
 * Wraps whatever the collection renders, so both views drag and offer the same menu.
 *
 * Selecting and opening belong to the collection, not here: a row that wired its own selection
 * fought the cell's — the press landed first and moved the anchor, so a range could never be
 * asked for — and a row that wired its own double-click left the shelf out of the tab order,
 * since a cell is only reachable when the collection is told what its rows answer to.
 *
 * Two gestures onto one table of destinations: right-click lists them all, and a drag hands the
 * kind to whatever it flies over.
 */
export function DraggableAsset({ asset, className, children }: DraggableAssetProps) {
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null)

  // Stable, or the open menu re-subscribes its three global listeners on every catalogue refresh.
  const closeMenu = useCallback(() => setMenuAt(null), [])

  /**
   * Takes the selection, unless this asset is already in it.
   *
   * A drag can start and a menu can open without a click, and the shelf must light up what they
   * act on. But a range picked in the collection would be wiped by dragging one of its members —
   * the very selection the shelf just gained the means to build.
   */
  const takeSelection = (): void => {
    const { selection, selectAssets } = useSelection.getState()
    if (selection.kind === 'asset' && selection.ids.includes(asset.id)) return

    selectAssets([asset.id])
  }

  return (
    <div
      className={className}
      draggable
      onDragStart={event => {
        takeSelection()
        startAssetDrag(event, asset)
      }}
      onContextMenu={event => {
        event.preventDefault()
        takeSelection()
        setMenuAt({ x: event.clientX, y: event.clientY })
      }}
    >
      {children}
      {menuAt && <AssetMenu asset={asset} at={menuAt} onClose={closeMenu} />}
    </div>
  )
}

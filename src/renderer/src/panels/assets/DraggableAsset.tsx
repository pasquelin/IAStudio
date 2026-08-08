import { useCallback, useState, type ReactNode } from 'react'
import type { Asset } from '@shared/domain/asset'
import { startAssetDrag } from '@/helpers/asset-drag'
import { openAsset } from '@/helpers/open-asset'
import { useSelection } from '@/stores/selection'
import { AssetMenu } from './AssetMenu'

export type DraggableAssetProps = {
  asset: Asset
  className?: string
  children: ReactNode
}

/**
 * Wraps whatever the collection renders, so both views drag, select, open and offer the same
 * menu.
 *
 * Three gestures onto one table of destinations: double-click takes the first that applies,
 * right-click lists them all, and a drag hands the kind to whatever it flies over. Before that
 * table, only the double-click could send an asset anywhere — and nothing on screen said so.
 */
export function DraggableAsset({ asset, className, children }: DraggableAssetProps) {
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null)

  // Stable, or the open menu re-subscribes its three global listeners on every catalogue refresh.
  const closeMenu = useCallback(() => setMenuAt(null), [])

  return (
    <div
      className={className}
      draggable
      onPointerDown={() => useSelection.getState().selectAssets([asset.id])}
      onDragStart={event => startAssetDrag(event, asset)}
      onDoubleClick={() => openAsset(asset)}
      onContextMenu={event => {
        event.preventDefault()
        // Selected first: the menu acts on this asset, and leaving the previous selection
        // standing would have the shelf highlighting one asset while the menu names another.
        useSelection.getState().selectAssets([asset.id])
        setMenuAt({ x: event.clientX, y: event.clientY })
      }}
    >
      {children}
      {menuAt && <AssetMenu asset={asset} at={menuAt} onClose={closeMenu} />}
    </div>
  )
}

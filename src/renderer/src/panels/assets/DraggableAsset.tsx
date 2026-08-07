import type { ReactNode } from 'react'
import type { Asset } from '@shared/domain/asset'
import { startAssetDrag } from '@/helpers/asset-drag'
import { openAsset } from '@/helpers/open-asset'
import { useSelection } from '@/stores/selection'

export type DraggableAssetProps = {
  asset: Asset
  className?: string
  children: ReactNode
}

/**
 * Wraps whatever the collection renders, so both views drag, select and open the same way.
 *
 * Double-click opens as well as drags: the shelf shares the screen with the montage, so a take
 * can be dragged onto a track — but reaching for one across the window is not always the gesture.
 */
export function DraggableAsset({ asset, className, children }: DraggableAssetProps) {
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

import { memo } from 'react'
import { posterUrl, type Asset } from '@shared/domain/asset'
import { MediaTile } from '@/design/MediaTile'
import { DraggableAsset } from './DraggableAsset'

/** Memoized: the grid remounts cards by the hundred while scrolling. */
export const AssetCard = memo(function AssetCard({ asset }: { asset: Asset }) {
  return (
    <DraggableAsset asset={asset}>
      <MediaTile url={posterUrl(asset) ?? undefined} caption={asset.name} />
    </DraggableAsset>
  )
})

import { memo } from 'react'
import { posterUrl, type Asset } from '@shared/domain/asset'
import { MediaTile } from '@/design/MediaTile'
import { assetIcon } from '@/helpers/workspaces'
import { DraggableAsset } from './DraggableAsset'

// Memoized, as the scene and layer rows are: asset identity survives a catalogue refresh that
// did not touch it, so one arriving poster re-renders one card instead of the whole grid.
export const AssetCard = memo(function AssetCard({ asset }: { asset: Asset }) {
  return (
    <DraggableAsset asset={asset}>
      <MediaTile
        url={posterUrl(asset) ?? undefined}
        caption={asset.name}
        fallbackIcon={assetIcon(asset.type)}
      />
    </DraggableAsset>
  )
})

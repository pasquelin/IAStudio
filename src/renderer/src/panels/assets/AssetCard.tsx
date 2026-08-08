import { memo } from 'react'
import { assetBadgeOf, posterUrl, type Asset } from '@shared/domain/asset'
import { AssetBadge } from '@/design/AssetBadge'
import { MediaTile } from '@/design/MediaTile'
import { assetIcon } from '@/helpers/workspaces'
import { DraggableAsset } from './DraggableAsset'

// Memoized, as the scene and layer rows are: asset identity survives a catalogue refresh that
// did not touch it, so one arriving poster re-renders one card instead of the whole grid.
export type AssetCardProps = {
  asset: Asset
  /** Resolved by the panel: the project the key opens onto, or null while it is unknown. */
  ownerId: string | null
}

export const AssetCard = memo(function AssetCard({ asset, ownerId }: AssetCardProps) {
  return (
    <DraggableAsset asset={asset}>
      <MediaTile
        url={posterUrl(asset) ?? undefined}
        caption={asset.name}
        fallbackIcon={assetIcon(asset.type)}
        badge={<AssetBadge badge={assetBadgeOf(asset, ownerId)} />}
      />
    </DraggableAsset>
  )
})

import { memo } from 'react'
import {
  assetBadgeOf,
  posterUrl,
  type Asset,
  type AssetBadge as BadgeName,
} from '@shared/domain/asset'
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
  /** Resolved by the panel too — translating per tile runs i18next per frame. */
  badgeLabels: Map<BadgeName, string>
}

export const AssetCard = memo(function AssetCard({ asset, ownerId, badgeLabels }: AssetCardProps) {
  const badge = assetBadgeOf(asset, ownerId)

  return (
    <DraggableAsset asset={asset}>
      <MediaTile
        url={posterUrl(asset) ?? undefined}
        caption={asset.name}
        fallbackIcon={assetIcon(asset.type)}
        badge={<AssetBadge badge={badge} label={badgeLabels.get(badge) ?? badge} overlay />}
      />
    </DraggableAsset>
  )
})

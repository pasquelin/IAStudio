import { memo } from 'react'
import { assetBadgeOf, type Asset, type AssetBadge as BadgeName } from '@shared/domain/asset'
import { AssetBadge } from '@/design/AssetBadge'
import { Row } from '@/design/Row'
import { DraggableAsset } from './DraggableAsset'

export type AssetRowProps = {
  asset: Asset
  /** Resolved by the panel, not here: translating per row runs i18next per frame. */
  typeLabel: string
  ownerId: string | null
  badgeLabels: Map<BadgeName, string>
}

// The type ends the line rather than sitting under the name: a subtitle would stack two lines
// into the 28 px this shelf gives a row, and `Row` is never told to size itself down.
export const AssetRow = memo(function AssetRow({
  asset,
  typeLabel,
  ownerId,
  badgeLabels,
}: AssetRowProps) {
  const badge = assetBadgeOf(asset, ownerId)

  return (
    // `h-full` on the wrapper: `Row` sizes itself against its parent, which is this div.
    <DraggableAsset asset={asset} className="h-full">
      <Row
        title={asset.name}
        actions={
          <span className="flex shrink-0 items-center gap-1">
            {/* The list has room the grid does not: every state is drawn, settled ones included. */}
            <AssetBadge badge={badge} label={badgeLabels.get(badge) ?? badge} showQuiet />
            <span className="text-muted text-[11px]">{typeLabel}</span>
          </span>
        }
      />
    </DraggableAsset>
  )
})

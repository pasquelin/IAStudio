import { memo } from 'react'
import type { Asset } from '@shared/domain/asset'
import { Row } from '@/design/Row'
import { DraggableAsset } from './DraggableAsset'

export type AssetRowProps = {
  asset: Asset
  /** Resolved by the panel, not here: translating per row runs i18next per frame. */
  typeLabel: string
}

// The type ends the line rather than sitting under the name: a subtitle would stack two lines
// into the 28 px this shelf gives a row, and `Row` is never told to size itself down.
export const AssetRow = memo(function AssetRow({ asset, typeLabel }: AssetRowProps) {
  return (
    // `h-full` on the wrapper: `Row` sizes itself against its parent, which is this div.
    <DraggableAsset asset={asset} className="h-full">
      <Row
        title={asset.name}
        actions={<span className="text-muted shrink-0 text-[11px]">{typeLabel}</span>}
      />
    </DraggableAsset>
  )
})

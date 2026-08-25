import { memo } from 'react'
import type { AssetBadge as BadgeName } from '@shared/domain/asset'
import { cloudPreviewUrl } from '@shared/domain/cloudAsset'
import { AssetBadge } from '@/design/AssetBadge'
import { Row } from '@/design/Row'
import { ROW_QUIET } from '@/design/styles'
import { Thumbnail } from '@/design/Thumbnail'
import { cn } from '@/helpers/cn'
import { LibraryAsset } from './LibraryAsset'
import { nameOfRow, type AssetRowModel, type RowHints } from './rows'

export type AssetRowProps = {
  row: AssetRowModel
  /** Resolved by the panel, not here: translating per row runs i18next per frame. */
  typeLabel: string
  badge: BadgeName
  badgeLabels: Map<BadgeName, string>
  hints: RowHints
}

/**
 * Every wrapper between the panel's cell and `Row`, and `min-w-0 flex-1` is the point: a flex item
 * defaults to `min-width: auto`, so a wrapper carrying only `h-full` is as wide as the longest
 * name in the list and `Row`'s `truncate` never fires — the panel scrolled sideways and the badge
 * went off its edge instead.
 */
const ROW_WRAPPER = 'h-full min-w-0 flex-1'

// The type ends the line rather than sitting under the name: a subtitle would stack two lines
// into the 28 px this panel gives a row, and `Row` is never told to size itself down.
export const AssetRow = memo(function AssetRow({
  row,
  typeLabel,
  badge,
  badgeLabels,
  hints,
}: AssetRowProps) {
  const preview = row.from === 'remote' ? cloudPreviewUrl(row.asset, 40) : null

  const line = (
    <Row
      media={preview ? <Thumbnail url={preview} /> : null}
      title={nameOfRow(row)}
      actions={
        <span className="flex shrink-0 items-center gap-2">
          {/* The list has room the grid does not: every state is drawn, settled ones included. */}
          <AssetBadge badge={badge} label={badgeLabels.get(badge) ?? badge} showQuiet />
          <span className={cn(ROW_QUIET, 'text-tiny')}>{typeLabel}</span>
        </span>
      }
    />
  )

  // A running generation has nothing to drag and nothing to fetch; the line it draws says what
  // it is waiting on, and nothing else on it does.
  if (row.from === 'job') {
    return (
      <div {...hints.generating} className={ROW_WRAPPER}>
        {line}
      </div>
    )
  }

  return (
    <LibraryAsset asset={row.asset} className={ROW_WRAPPER}>
      <div {...hints.fetch} className={ROW_WRAPPER}>
        {line}
      </div>
    </LibraryAsset>
  )
})

import { memo } from 'react'
import type { AssetBadge as BadgeName } from '@shared/domain/asset'
import { cloudPreviewUrl } from '@shared/domain/cloudAsset'
import { AssetBadge } from '@/components/AssetBadge'
import { Row } from '@/components/Row'
import { ROW_QUIET, ROW_WRAPPER } from '@/components/styles'
import { Thumbnail } from '@/components/Thumbnail'
import { cn } from '@/helpers/cn'
import { LibraryAsset } from '../LibraryAsset'
import { nameOfRow, type AssetRowModel, type RowHints } from './rows'

export type AssetRowProps = {
  row: AssetRowModel
  /** Resolved by the panel, not here: translating per row runs i18next per frame. */
  typeLabel: string
  badge: BadgeName
  badgeLabels: Map<BadgeName, string>
  hints: RowHints
}

// The type ends the line rather than sitting under the name: a second level would make the row a
// `picture` one, and what this panel needs read at a glance is the thumbnail, not two words.
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

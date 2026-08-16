import { memo } from 'react'
import type { AssetBadge as BadgeName } from '@shared/domain/asset'
import { AssetBadge } from '@/design/AssetBadge'
import { InlineRename } from '@/design/InlineRename'
import { Row } from '@/design/Row'
import { ROW_QUIET } from '@/design/styles'
import { cn } from '@/helpers/cn'
import { DraggableAsset } from './DraggableAsset'
import { LibraryAsset } from './LibraryAsset'
import { nameOfRow, type AssetRenameHandle, type AssetRowModel } from './rows'

export type AssetRowProps = {
  row: AssetRowModel
  /** Resolved by the panel, not here: translating per row runs i18next per frame. */
  typeLabel: string
  badge: BadgeName
  badgeLabels: Map<BadgeName, string>
  /** Built once by the panel — see `AssetCardProps.hints`. */
  hints: { fetch: Record<string, string>; generating: Record<string, string> }
  /** Renaming, when this row is the one being renamed. */
  rename?: AssetRenameHandle
}

// The type ends the line rather than sitting under the name: a subtitle would stack two lines
// into the 28 px this shelf gives a row, and `Row` is never told to size itself down.
export const AssetRow = memo(function AssetRow({
  row,
  typeLabel,
  badge,
  badgeLabels,
  hints,
  rename,
}: AssetRowProps) {
  // The row becomes the field, as the explorer's and the document list's do.
  const line = rename?.open ? (
    <InlineRename value={nameOfRow(row)} label={rename.label} onCommit={rename.commit} />
  ) : (
    <Row
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

  // Same rule as the card: only a row backed by a file can be dragged into a document — and the
  // two that are not here yet say what a double-click will do, which nothing else on the line does.
  if (row.from === 'remote') {
    return (
      <LibraryAsset asset={row.asset} className="h-full">
        <div {...hints.fetch}>{line}</div>
      </LibraryAsset>
    )
  }

  if (row.from === 'job') return <div {...hints.generating}>{line}</div>

  // `h-full` on the wrapper: `Row` sizes itself against its parent, which is this div.
  return (
    <DraggableAsset
      asset={row.asset}
      className="h-full"
      {...(rename ? { onRename: rename.start } : {})}
    >
      {line}
    </DraggableAsset>
  )
})

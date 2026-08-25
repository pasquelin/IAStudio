import { memo, type ReactNode } from 'react'
import { assetUrl, posterUrl, type AssetBadge as BadgeName } from '@shared/domain/asset'
import { cloudPreviewUrl } from '@shared/domain/cloudAsset'
import { AssetBadge } from '@/design/AssetBadge'
import { InlineRename } from '@/design/InlineRename'
import { Row } from '@/design/Row'
import { ROW_QUIET } from '@/design/styles'
import { Thumbnail } from '@/design/Thumbnail'
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

/**
 * Every wrapper between the shelf's cell and `Row`, and `min-w-0 flex-1` is the point: a flex
 * item defaults to `min-width: auto`, so a wrapper carrying only `h-full` is as wide as the
 * longest name in the list and `Row`'s `truncate` never fires — the shelf scrolled sideways and
 * the badge went off the panel edge instead.
 */
const ROW_WRAPPER = 'h-full min-w-0 flex-1'

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
  const thumbnailUrl =
    row.from === 'local'
      ? (posterUrl(row.asset) ?? assetUrl(row.asset.id))
      : row.from === 'remote'
        ? cloudPreviewUrl(row.asset, 40)
        : undefined

  const thumbnail: ReactNode = thumbnailUrl ? <Thumbnail url={thumbnailUrl} /> : null

  // The row becomes the field, as the explorer's and the document list's do.
  const line = rename?.open ? (
    <InlineRename value={nameOfRow(row)} label={rename.label} onCommit={rename.commit} />
  ) : (
    <Row
      media={thumbnail}
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
      <LibraryAsset asset={row.asset} className={ROW_WRAPPER}>
        <div {...hints.fetch} className={ROW_WRAPPER}>
          {line}
        </div>
      </LibraryAsset>
    )
  }

  if (row.from === 'job') {
    return (
      <div {...hints.generating} className={ROW_WRAPPER}>
        {line}
      </div>
    )
  }

  return (
    <DraggableAsset
      asset={row.asset}
      className={ROW_WRAPPER}
      {...(rename ? { onRename: rename.start } : {})}
    >
      {line}
    </DraggableAsset>
  )
})

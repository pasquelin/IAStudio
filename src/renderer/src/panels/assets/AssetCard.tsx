import { memo } from 'react'
import type { AssetBadge as BadgeName, AssetType } from '@shared/domain/asset'
import { AssetBadge } from '@/design/AssetBadge'
import { AssetTypeMark } from '@/design/AssetTypeMark'
import { MediaTile } from '@/design/MediaTile'
import { MEDIA_FRAME } from '@/design/styles'
import { ProgressBar } from '@/design/ProgressBar'
import { Spinner } from '@/design/Spinner'
import { cloudTileFace } from '@/helpers/cloudTile'
import { cn } from '@/helpers/cn'
import { LibraryAsset } from './LibraryAsset'
import { nameOfRow, typeOfRow, type AssetRowModel } from './rows'

/** The width a tile occupies. What the CDN is asked for follows, once density is applied. */
const PREVIEW_WIDTH = 220

// Memoized, as the scene and layer rows are: asset identity survives a catalogue refresh that
// did not touch it, so one arriving poster re-renders one card instead of the whole grid.
export type AssetCardProps = {
  row: AssetRowModel
  /** Resolved by the panel: what the line's mark says, badge included for the two new states. */
  badge: BadgeName
  /** Resolved by the panel too — translating per tile runs i18next per frame. */
  badgeLabels: Map<BadgeName, string>
  /** Resolved by the panel too, for the same reason as `badgeLabels`. */
  typeLabels: Map<AssetType, string>
  /**
   * The tooltip attributes for the two provenances that need a gesture explained, already
   * built. Same reason as the labels, and the same mistake avoided: a `useTranslation` here
   * subscribes every one of two hundred cells and allocates a fresh attribute object per frame.
   */
  hints: { fetch: Record<string, string>; generating: Record<string, string> }
}

export const AssetCard = memo(function AssetCard({
  row,
  badge,
  badgeLabels,
  typeLabels,
  hints,
}: AssetCardProps) {
  const type = typeOfRow(row)

  /**
   * Both corners at once: what the asset IS on the left, where it lives on the right.
   *
   * Handed to `MediaTile` as one node because its slot takes one — each mark places itself, as
   * that slot's contract says.
   */
  const mark = (
    <>
      {type && <AssetTypeMark type={type} label={typeLabels.get(type) ?? type} />}
      <AssetBadge badge={badge} label={badgeLabels.get(badge) ?? badge} overlay />
    </>
  )

  // A hint and never an `aria-label`: the tile's name is already on screen in its caption, and
  // one set over a visible name replaces it for a screen reader (WCAG 2.5.3). What these two
  // lines need said is the GESTURE — a picture that is not here yet does not look any different
  // from one that is, and nothing else on the tile says what a double-click will do.
  if (row.from === 'remote') {
    return (
      <LibraryAsset asset={row.asset}>
        <div className="relative" {...hints.fetch}>
          <MediaTile {...cloudTileFace(row.asset, PREVIEW_WIDTH)} badge={mark} />
          {/* A veil and a spinner, and the badge alone is why they exist: `remote-only` and
              `fetching` are two blue download glyphs in a 12 px corner, and a 45 Ko picture is
              here in 200 ms — the mark changed faster than an eye can tell two similar ones
              apart. `scrim` is the token for exactly this: it darkens without hiding what is
              underneath, so the picture still reads through it. */}
          {badge === 'fetching' && (
            <div
              className={cn(
                'bg-scrim pointer-events-none absolute inset-0',
                'flex items-center justify-center',
                // The frame the tile itself cuts its corners with, never a radius written here.
                MEDIA_FRAME,
              )}
            >
              <Spinner label={badgeLabels.get('fetching') ?? ''} className="text-text" />
            </div>
          )}
        </div>
      </LibraryAsset>
    )
  }

  return (
    <div className="relative" {...hints.generating}>
      <MediaTile caption={nameOfRow(row)} badge={mark} />
      {/* The design system's bar, not one drawn here: it already carries the `progressbar` role
          and the percentage a screen reader reads out, which a bare div would have silently
          dropped. Laid over the foot of the tile, where the caption's gradient is darkest. */}
      <ProgressBar
        ratio={row.job.progress}
        label={nameOfRow(row)}
        className="absolute inset-x-0 bottom-0 rounded-none"
      />
    </div>
  )
})

import type { ReactNode } from 'react'
import { MediaTile } from '@/design/MediaTile'
import { UiIcon } from '@/design/UiIcon'
import { FOCUS_RING } from '@/design/styles'
import { cn } from '@/helpers/cn'

/** What one card of a home shelf measures. Written once so two shelves cannot drift apart. */
export const SHELF_CARD_HEIGHT = 84

/** And what a picture tile measures, square. Same reason, and three shelves now read it. */
export const SHELF_TILE_SIZE = 132

export type ShelfCardProps = {
  icon: string
  title: string
  /** The line under the name — a date, a workspace. Truncated, never wrapped. */
  subtitle: string
  /** Native tooltip, for a card whose title is cut short. */
  hint?: string
  onClick: () => void
}

/**
 * One card of a horizontal shelf: a glyph, a name, a line underneath.
 *
 * Shared by the projects and the documents shelves, which had it twice, byte for byte. A third
 * shelf arrives with the next lot; the point of this file is that it will not be a fourth copy.
 */
export function ShelfCard({ icon, title, subtitle, hint, onClick }: ShelfCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={hint}
      className={cn(
        'bg-surface hover:bg-elevated flex size-full cursor-pointer flex-col justify-center',
        'gap-2 rounded-(--radius-sc-md) border-none px-3 text-left transition-colors',
        FOCUS_RING,
      )}
    >
      <span className="flex items-center gap-2">
        <UiIcon path={icon} size={16} className="text-muted shrink-0" />
        <span className="text-text truncate text-[12px]">{title}</span>
      </span>
      <span className="text-muted truncate text-[11px]">{subtitle}</span>
    </button>
  )
}

export type ShelfTileProps = {
  url?: string
  /** Overlaid at the foot of the picture. The model's name, on all three shelves that use it. */
  caption: string
  fallbackIcon: string
  /** Native tooltip — the prompt, usually, which no caption has room for. */
  hint?: string
  label: string
  /** Absent leaves the picture inert: the library shows what an account holds with no project. */
  onClick?: () => void
  /** A second action, laid over the corner. Beside the tile rather than inside it: no nesting. */
  corner?: ReactNode
}

/**
 * One picture of a shelf, and the one thing clicking it does.
 *
 * The creations, the library and the recipes each draw the same square: a still, the model
 * underneath, a glyph when there is no picture. They had it three times, byte for byte, down to
 * the hover — which is exactly what `ShelfCard` above exists to prevent.
 */
export function ShelfTile({
  url,
  caption,
  fallbackIcon,
  hint,
  label,
  onClick,
  corner,
}: ShelfTileProps) {
  const tile = <MediaTile url={url} caption={caption} fallbackIcon={fallbackIcon} />

  return (
    <div className="relative size-full" title={hint}>
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          className={cn(
            'absolute inset-0 cursor-pointer rounded-(--radius-sc-md) border-none',
            'bg-transparent p-0 hover:opacity-90',
            FOCUS_RING,
          )}
        >
          {tile}
        </button>
      ) : (
        tile
      )}

      {corner}
    </div>
  )
}

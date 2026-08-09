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
  /** Absent for a card that stands for something with no glyph of its own — a model's spend. */
  icon?: string
  title: string
  /** The line under the name — a date, a workspace, two figures. Truncated, never wrapped. */
  subtitle: string
  /** Native tooltip, for a card whose title is cut short. */
  hint?: string
  /** Absent leaves the card inert, as `ShelfTile` already allowed: a spend opens nothing. */
  onClick?: () => void
}

/** The shape both forms draw. Only the hover and the focus ring belong to the pressable one. */
const CARD = 'bg-surface flex size-full flex-col justify-center gap-2 rounded-(--radius-sc-md) px-3'

/**
 * One card of a horizontal shelf: a name, a line underneath, and a glyph when there is one.
 *
 * Shared by the projects and the documents shelves, which had it twice, byte for byte — and by
 * the usage band, which had redrawn it a third time to be rid of the glyph and the click.
 */
export function ShelfCard({ icon, title, subtitle, hint, onClick }: ShelfCardProps) {
  const body = (
    <>
      <span className="flex items-center gap-2">
        {icon !== undefined && <UiIcon path={icon} size={16} className="text-muted shrink-0" />}
        <span className="text-text truncate text-[12px]">{title}</span>
      </span>
      <span className="text-muted truncate text-[11px]">{subtitle}</span>
    </>
  )

  // A card nothing happens on is not a button: announced as one, it promises an action to a
  // reader who then finds none.
  if (!onClick) {
    return (
      <div title={hint} className={CARD}>
        {body}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={hint}
      className={cn(
        CARD,
        'hover:bg-elevated cursor-pointer border-none text-left transition-colors',
        FOCUS_RING,
      )}
    >
      {body}
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

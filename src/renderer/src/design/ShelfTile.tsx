import type { ReactNode } from 'react'
import { MediaTile } from './MediaTile'
import { OVERLAY_BUTTON } from './styles'
import { activation } from '@/helpers/activation'
import { cn } from '@/helpers/cn'
import { TIP_BOTTOM, type TooltipFactory } from '@/helpers/tooltip'

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
  /**
   * OPENING what the tile shows — the double-click, and Enter with it. A second gesture rather
   * than a second meaning of `onClick`: a shelf whose single click already does something must
   * not have that something happen twice on the way to opening.
   */
  onActivate?: () => void
  /** A second action, laid over the corner. Beside the tile rather than inside it: no nesting. */
  corner?: ReactNode
  /**
   * Placement of the name's tooltip, from the host. A band read across the page wants it below;
   * a grid in a 260 px column wants it to the side, or it overflows the panel it is in.
   */
  tip?: TooltipFactory
}

/**
 * One picture of a shelf, and the one thing clicking it does.
 *
 * The creations, the library and the recipes each draw the same square: a still, the model
 * underneath, a glyph when there is no picture. They had it three times, byte for byte, down to
 * the hover, and this is the one copy left.
 */
export function ShelfTile({
  url,
  caption,
  fallbackIcon,
  hint,
  label,
  onClick,
  onActivate,
  corner,
  tip = TIP_BOTTOM,
}: ShelfTileProps) {
  const tile = <MediaTile url={url} caption={caption} fallbackIcon={fallbackIcon} />

  return (
    // Its own hover group, which `SHELF_OVERLAY` reads: in a panel's grid there is no carousel
    // around the tile to hover, and the corner action would never appear.
    <div className="group/tile relative size-full">
      {onClick || onActivate ? (
        <button
          type="button"
          onClick={onClick}
          {...(onActivate ? activation(onActivate) : {})}
          {...tip(label, false, hint)}
          className={cn(OVERLAY_BUTTON, 'rounded-(--radius-sc-md) p-0 hover:opacity-90')}
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

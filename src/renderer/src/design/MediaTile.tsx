import { mdiImageOffOutline } from '@mdi/js'
import type { ReactNode } from 'react'
import { cn } from '@/helpers/cn'
import { useLoadable } from '@/hooks/useLoadable'
import { MEDIA_FRAME } from './styles'
import { UiIcon } from './UiIcon'

export type MediaTileProps = {
  url?: string
  /** Overlaid on the picture, at the bottom. */
  caption: string
  /**
   * Overlaid on the picture — a standing or a state, never an action. WHICH corner is the badge's
   * own business: this slot renders it as handed over, `AssetBadge` places itself top right, and a
   * channel tile puts its origin top left because the menu button owns the other corner.
   */
  badge?: ReactNode
  /**
   * Drawn in place of the picture. Defaults to a broken image, which is only honest where one
   * was expected: a sound has no thumbnail to fail at, and saying otherwise reads as a bug.
   */
  fallbackIcon?: string
  /**
   * Fills the box it is given instead of squaring itself off. For a caller that has already
   * reserved the exact place — the masonry does, from the asset's own dimensions, and a square
   * forced on top of that would crop every picture that is not one.
   */
  fill?: boolean
}

/**
 * A square tile: the picture fills it and the caption sits inside. A caption underneath would
 * spend a fifth of every row on one line of text, in panels whose whole point is the images.
 *
 * The caption stays legible over any picture through three layers — a gradient, a shadow and
 * white — because an example can be pale, dark or busy, and often is.
 */
export function MediaTile({
  url,
  caption,
  badge,
  fallbackIcon = mdiImageOffOutline,
  fill = false,
}: MediaTileProps) {
  const { src, onError } = useLoadable(url)

  return (
    <figure className={cn(MEDIA_FRAME, 'relative m-0 w-full', fill ? 'h-full' : 'aspect-square')}>
      {src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          onError={onError}
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <UiIcon path={fallbackIcon} size={20} className="text-muted/30 absolute inset-0 m-auto" />
      )}

      {badge}

      <figcaption
        title={caption}
        className={cn(
          'absolute inset-x-0 bottom-0 truncate px-1.5 pt-5 pb-1',
          'bg-gradient-to-t from-black/85 via-black/45 to-transparent',
          'text-tiny text-white drop-shadow-[0_1px_2px_black]',
        )}
      >
        {caption}
      </figcaption>
    </figure>
  )
}

import { mdiImageOffOutline } from '@mdi/js'
import type { ReactNode } from 'react'
import { cn } from '@/helpers/cn'
import { useLoadable } from '@/hooks/useLoadable'
import { MEDIA_FRAME, MEDIA_SHAPE } from './styles'
import { UiIcon } from './UiIcon'

export type MediaTileProps = {
  url?: string
  /** Overlaid on the picture, at the bottom. */
  caption: string
  /**
   * Drawn in the caption's place while it is being edited — the field that renames what the
   * tile shows. The caption itself stays: it is what the tile is titled by, and a name being
   * typed is not yet the name of anything.
   */
  captionField?: ReactNode
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
   * A face of its own for a medium no picture stands for — a sound, drawn as its waveform.
   *
   * Under the caption and the badge rather than over them, which is the whole reason it is a
   * slot here instead of something laid over the tile by the caller: an overlay would cover the
   * name, and a tile whose name is hidden is a shelf one has to hover to read.
   *
   * Wins over `fallbackIcon`, never over the picture: an asset that HAS a still shows it.
   */
  face?: ReactNode
  /**
   * Fills the box it is given instead of squaring itself off. For a caller that has already
   * reserved the exact place — the masonry does, from the asset's own dimensions, and a square
   * forced on top of that would crop every picture that is not one.
   */
  fill?: boolean
  /**
   * Drops the plate and the border, keeping the corners — for a tile that draws a SHAPE rather
   * than a picture. The frame exists to bound a picture that may be pale, dark or transparent;
   * a folder silhouette has nothing to bound, and a box around it reads as a file.
   */
  bare?: boolean
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
  captionField,
  badge,
  fallbackIcon = mdiImageOffOutline,
  face,
  fill = false,
  bare = false,
}: MediaTileProps) {
  const { src, onError } = useLoadable(url)

  return (
    <figure
      className={cn(
        bare ? MEDIA_SHAPE : MEDIA_FRAME,
        'relative m-0 w-full',
        fill ? 'h-full' : 'aspect-square',
      )}
    >
      {src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          onError={onError}
          className="absolute inset-0 size-full object-cover"
        />
      ) : face ? (
        <div className="absolute inset-0">{face}</div>
      ) : (
        <UiIcon path={fallbackIcon} size={20} className="text-muted/80 absolute inset-0 m-auto" />
      )}

      {badge}

      {/* The one white the studio writes outright, and the only place it can be: this word sits
          on a PICTURE, which no token can describe. Its contrast comes from the gradient under it
          and the shadow around it, not from a palette that knows nothing of what was generated. */}
      <figcaption
        title={caption}
        className={cn(
          'absolute inset-x-0 bottom-0 truncate px-1.5 pt-5 pb-1',
          'bg-gradient-to-t from-black/85 via-black/45 to-transparent',
          'text-tiny text-white drop-shadow-[0_1px_2px_black]',
        )}
      >
        {captionField ?? caption}
      </figcaption>
    </figure>
  )
}

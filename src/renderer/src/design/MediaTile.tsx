import { mdiImageOffOutline } from '@mdi/js'
import type { ReactNode } from 'react'
import { cn } from '@/helpers/cn'
import { LoadableImage } from './LoadableImage'
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
  /**
   * Cuts the picture to the document silhouette and gives it the shape's box, so one tile says
   * both what the entry is and what it holds. Goes with `bare`: the frame it drops is the very
   * square this replaces.
   */
  cutout?: boolean
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
  cutout = false,
}: MediaTileProps) {
  return (
    <figure
      className={cn(
        bare ? MEDIA_SHAPE : MEDIA_FRAME,
        'relative m-0 w-full',
        fill ? 'h-full' : 'aspect-square',
      )}
    >
      <LoadableImage
        url={url}
        // A cut picture takes the SHAPE's box, held clear of the caption: cut to a silhouette it
        // reads as placed, the way the folder beside it does, and not as filling the square.
        box={cn('absolute inset-0', cutout && 'bottom-4 flex items-end justify-center')}
        className={cn(
          'object-cover',
          cutout ? 'document-cutout aspect-square h-full' : 'size-full',
        )}
        fallback={
          face ? (
            // Held clear of the caption and centred when there is no picture: a shape reads as
            // placed where a picture reads as filling, and the two want opposite boxes.
            <div
              className={cn('absolute inset-0', bare && 'bottom-4 flex items-end justify-center')}
            >
              {face}
            </div>
          ) : (
            <UiIcon
              path={fallbackIcon}
              size={20}
              className="text-muted/80 absolute inset-0 m-auto"
            />
          )
        }
      />

      {badge}

      {/* The white and the gradient go together, and neither survives `bare`: they exist because
          the word sits on a PICTURE, which no token can describe. Over a shape on the panel's own
          ground there IS a token, and a black band under a silhouette is a box drawn back on. */}
      <figcaption
        title={caption}
        className={cn(
          'text-tiny absolute inset-x-0 bottom-0 truncate px-1.5 pb-1',
          bare
            ? 'text-text text-center'
            : 'bg-gradient-to-t from-black/85 via-black/45 to-transparent pt-5 text-white drop-shadow-[0_1px_2px_black]',
        )}
      >
        {captionField ?? caption}
      </figcaption>
    </figure>
  )
}

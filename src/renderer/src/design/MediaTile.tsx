import { mdiImageOffOutline } from '@mdi/js'
import { useState, type ReactNode } from 'react'
import { cn } from './cn'
import { UiIcon } from './UiIcon'

export const FRAME = 'border-border bg-surface overflow-hidden rounded-(--radius-sc-sm) border'

/**
 * A picture that fails to load leaves the browser's broken-image glyph in place. The URLs the
 * API signs expire, so this is not hypothetical — the placeholder has to take over.
 */
export function useLoadable(url?: string): { src?: string; onError: () => void } {
  const [broken, setBroken] = useState<string | null>(null)
  const usable = url && url !== broken ? url : undefined

  return { src: usable, onError: () => setBroken(url ?? null) }
}

export type MediaTileProps = {
  url?: string
  /** Overlaid on the picture, at the bottom. */
  caption: string
  /** Overlaid at the top right — a standing or a state, never an action. */
  badge?: ReactNode
}

/**
 * A square tile: the picture fills it and the caption sits inside. A caption underneath would
 * spend a fifth of every row on one line of text, in panels whose whole point is the images.
 *
 * The caption stays legible over any picture through three layers — a gradient, a shadow and
 * white — because an example can be pale, dark or busy, and often is.
 */
export function MediaTile({ url, caption, badge }: MediaTileProps) {
  const { src, onError } = useLoadable(url)

  return (
    <figure className={cn(FRAME, 'relative m-0 aspect-square w-full')}>
      {src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          onError={onError}
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <UiIcon
          path={mdiImageOffOutline}
          size={20}
          className="text-muted/30 absolute inset-0 m-auto"
        />
      )}

      {badge}

      <figcaption
        title={caption}
        className={cn(
          'absolute inset-x-0 bottom-0 truncate px-1.5 pt-5 pb-1',
          'bg-gradient-to-t from-black/85 via-black/45 to-transparent',
          'text-[11px] text-white drop-shadow-[0_1px_2px_black]',
        )}
      >
        {caption}
      </figcaption>
    </figure>
  )
}

/** The same picture at a fixed size, for a list row or a header. */
export function Thumbnail({ url, shape }: { url?: string; shape: string }) {
  const { src, onError } = useLoadable(url)

  if (!src) {
    return (
      <div className={cn(FRAME, shape, 'flex items-center justify-center')}>
        <UiIcon path={mdiImageOffOutline} size={16} className="text-muted/30" />
      </div>
    )
  }

  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={onError}
      className={cn(FRAME, shape, 'object-cover')}
    />
  )
}

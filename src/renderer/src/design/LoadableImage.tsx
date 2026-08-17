import type { ReactNode } from 'react'
import { useLoadable } from '@/hooks/useLoadable'

export type LoadableImageProps = {
  url?: string
  className?: string
  /** Drawn in the picture's place while there is none to draw — an icon, a shape, nothing. */
  fallback?: ReactNode
  /** A box the picture is placed in, for a caller that reserves the place rather than filling it. */
  box?: string
  draggable?: boolean
}

/**
 * A picture that asks once more when it fails, and hands over to `fallback` when it will not come.
 *
 * The retry is spent by the `key` on the tag, which is why the tag is drawn here and not by each
 * caller: read off the hook and dropped, the retry buys nothing and nothing says so. Three
 * callers had to be taught that by hand.
 */
export function LoadableImage({
  url,
  className,
  fallback = null,
  box,
  draggable,
}: LoadableImageProps) {
  const { src, attempt, onError } = useLoadable(url)

  if (!src) return <>{fallback}</>

  const picture = (
    <img
      key={attempt}
      src={src}
      alt=""
      loading="lazy"
      draggable={draggable}
      onError={onError}
      className={className}
    />
  )

  return box ? <div className={box}>{picture}</div> : picture
}

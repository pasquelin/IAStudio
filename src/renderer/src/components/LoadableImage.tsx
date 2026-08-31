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
 * The `key` on the tag is what spends that retry, and the tag is drawn here so that no caller can
 * drop it: read off the hook and forgotten, the retry buys nothing and nothing says so.
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
      decoding="async"
      draggable={draggable}
      onError={onError}
      className={className}
    />
  )

  return box ? <div className={box}>{picture}</div> : picture
}

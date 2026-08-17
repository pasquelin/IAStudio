import { mdiImageOffOutline } from '@mdi/js'
import { cn } from '@/helpers/cn'
import { useLoadable } from '@/hooks/useLoadable'
import { MEDIA_FRAME } from './styles'
import { UiIcon } from './UiIcon'

export type ThumbnailProps = {
  url?: string
  /** Its size, which the caller owns: a row and a header ask for different ones. */
  className?: string
}

export function Thumbnail({ url, className }: ThumbnailProps) {
  const { src, attempt, onError } = useLoadable(url)
  const frame = cn(MEDIA_FRAME, 'shrink-0', className)

  return src ? (
    // Never draggable: an `img` is by default, and these sit inside drop targets — dragging one
    // slot onto another looked like the obvious gesture and did nothing at all, in silence,
    // because what flew was the browser's own picture drag and no channel of ours.
    <img
      key={attempt}
      src={src}
      alt=""
      loading="lazy"
      draggable={false}
      onError={onError}
      className={cn(frame, 'object-cover')}
    />
  ) : (
    <div className={cn(frame, 'flex items-center justify-center')}>
      <UiIcon path={mdiImageOffOutline} size={16} className="text-muted/30" />
    </div>
  )
}

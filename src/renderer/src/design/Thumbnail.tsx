import { mdiImageOffOutline } from '@mdi/js'
import { cn } from '@/helpers/cn'
import { LoadableImage } from './LoadableImage'
import { MEDIA_FRAME } from './styles'
import { UiIcon } from './UiIcon'

export type ThumbnailProps = {
  url?: string
  /** Its size. A row hands it a box and it fills it; a property field names a gauge. */
  className?: string
}

export function Thumbnail({ url, className = 'size-full' }: ThumbnailProps) {
  const frame = cn(MEDIA_FRAME, 'shrink-0', className)

  return (
    // Never draggable: an `img` is by default, and these sit inside drop targets — dragging one
    // slot onto another looked like the obvious gesture and did nothing at all, in silence,
    // because what flew was the browser's own picture drag and no channel of ours.
    <LoadableImage
      url={url}
      draggable={false}
      className={cn(frame, 'object-cover')}
      fallback={
        <div className={cn(frame, 'flex items-center justify-center')}>
          <UiIcon path={mdiImageOffOutline} size={16} className="text-muted/30" />
        </div>
      }
    />
  )
}

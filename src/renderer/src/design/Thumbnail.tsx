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
  const { src, onError } = useLoadable(url)
  const frame = cn(MEDIA_FRAME, 'shrink-0', className)

  return src ? (
    <img src={src} alt="" loading="lazy" onError={onError} className={cn(frame, 'object-cover')} />
  ) : (
    <div className={cn(frame, 'flex items-center justify-center')}>
      <UiIcon path={mdiImageOffOutline} size={16} className="text-muted/30" />
    </div>
  )
}

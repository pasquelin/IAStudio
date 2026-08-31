import { mdiChevronLeft, mdiChevronRight } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { cn } from '@/helpers/cn'
import { TIP_TOP } from '@/helpers/tooltip'
import { SHELF_OVERLAY } from '../styles'
import { UiIcon } from '../UiIcon'

export type CarouselArrowProps = {
  side: 'left' | 'right'
  hidden: boolean
  onClick: () => void
}

/**
 * Revealed by hovering the shelf: a control permanently laid over the artwork hides part of
 * what the shelf exists to show. It disappears at the end it can no longer serve rather than
 * sitting there greyed — there is no rail left to point at.
 *
 * Named, so a screen reader can announce it, but out of the tab order: the rail itself takes
 * focus and scrolls with the arrow keys, which is the shorter path. A tab stop per direction
 * on every shelf would put a dozen presses between the home and its first card.
 */
export function CarouselArrow({ side, hidden, onClick }: CarouselArrowProps) {
  const { t } = useTranslation()
  if (hidden) return null

  return (
    <button
      type="button"
      tabIndex={-1}
      {...TIP_TOP(t(side === 'left' ? 'carousel.previous' : 'carousel.next'))}
      onClick={onClick}
      className={cn(
        SHELF_OVERLAY,
        'text-text top-1/2 size-7 -translate-y-1/2',
        'hover:bg-elevated shadow-(--sc-shadow-floating)',
        side === 'left' ? 'left-1' : 'right-1',
      )}
    >
      <UiIcon path={side === 'left' ? mdiChevronLeft : mdiChevronRight} size={16} />
    </button>
  )
}

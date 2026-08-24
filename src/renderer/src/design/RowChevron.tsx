import { mdiChevronDown, mdiChevronRight } from '@mdi/js'
import { cn } from '@/helpers/cn'
import { UiIcon } from './UiIcon'

export type RowChevronProps = {
  /** Whether the row has anything to open. A leaf keeps the column and draws nothing in it. */
  expandable: boolean
  expanded: boolean
  onToggle: () => void
  className?: string
}

/**
 * The twist a row opens by, and the column it stands in — written once for `Tree` and
 * `Collection`, whose rows must open by the same 12px glyph in the same 12px column.
 *
 * Not a control: the row carries `aria-expanded` and the arrows already toggle it. It is named
 * by `data-chevron` because it has no other handle, being `aria-hidden`.
 */
export function RowChevron({ expandable, expanded, onToggle, className }: RowChevronProps) {
  return (
    <span
      aria-hidden="true"
      data-chevron
      className={cn('flex w-3 shrink-0 justify-center', className)}
      onPointerDown={event => {
        if (!expandable) return
        // The row selects on pointer down, which fires before click: stopping the click alone
        // would still have let the chevron steal the selection.
        event.stopPropagation()
        onToggle()
      }}
    >
      {expandable && <UiIcon path={expanded ? mdiChevronDown : mdiChevronRight} size={12} />}
    </span>
  )
}

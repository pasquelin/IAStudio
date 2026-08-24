import { mdiChevronDown, mdiChevronRight } from '@mdi/js'
import { UiIcon } from './UiIcon'

export type RowChevronProps = {
  /** Whether the row has anything to open. A leaf keeps the column and draws nothing in it. */
  expandable: boolean
  expanded: boolean
  onToggle: () => void
}

/**
 * The twist a row opens by, and the column it stands in — written once for `Tree` and
 * `Collection`, whose rows must open by the same 12px glyph in the same 12px column.
 *
 * Not a control: the row carries `aria-expanded` and the arrows already toggle it. It is named
 * by `data-chevron` because it has no other handle, being `aria-hidden`.
 */
export function RowChevron({ expandable, expanded, onToggle }: RowChevronProps) {
  // 🛑 All three, and each is a different host: `Tree` selects on POINTER DOWN, `Collection`
  // selects on CLICK and opens the row on DOUBLE-CLICK. Stopping the first alone let a press on
  // the chevron collapse a shelf's whole selection onto that row, and a quick double-tap open
  // the asset as a document.
  const swallow = (event: { stopPropagation: () => void }): void => event.stopPropagation()

  return (
    <span
      aria-hidden="true"
      data-chevron
      className="flex w-3 shrink-0 justify-center"
      onClick={expandable ? swallow : undefined}
      onDoubleClick={expandable ? swallow : undefined}
      onPointerDown={event => {
        if (!expandable) return
        swallow(event)
        onToggle()
      }}
    >
      {expandable && <UiIcon path={expanded ? mdiChevronDown : mdiChevronRight} size={12} />}
    </span>
  )
}

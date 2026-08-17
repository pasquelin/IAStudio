import { mdiChevronDown } from '@mdi/js'
import { cn } from '@/helpers/cn'
import type { FacetOption } from '@/helpers/collection-state'
import { TIP_BOTTOM } from '@/helpers/tooltip'
import { CONTROL } from '../styles'
import { UiIcon } from '../UiIcon'

export type CollectionBarDropdownProps = {
  label: string
  options: readonly FacetOption[]
  value: string
  onPick: (value: string) => void
  /** The entry standing for "no choice"; absent makes the dropdown a required pick. */
  anyLabel?: string
  className?: string
}

/**
 * A native `<select>`, and deliberately so. A tool window is narrow, and a menu drawn inside
 * the panel gets clipped by its edge; the platform draws this one above the window itself.
 *
 * Its own chevron is dropped — the browser pins that one to the edge of the control, where no
 * padding can reach it — and drawn here instead. Only the closed control is restyled; the
 * open menu stays the platform's, which is the whole point of using a `<select>`.
 */
export function CollectionBarDropdown({
  label,
  options,
  value,
  onPick,
  anyLabel,
  className,
}: CollectionBarDropdownProps) {
  return (
    <div className={cn('relative flex min-w-0 items-center', className)}>
      {/* Tipped with the facet's name: once a value is picked, the closed control shows the
          value and the name it filters on is nowhere on screen. */}
      <select
        {...TIP_BOTTOM(label)}
        value={value}
        onChange={event => onPick(event.target.value)}
        className={cn(
          CONTROL,
          'w-full min-w-0 cursor-pointer appearance-none border-none pr-6 pl-2',
          !value && 'text-muted',
        )}
      >
        {anyLabel !== undefined && <option value="">{anyLabel}</option>}
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <UiIcon
        path={mdiChevronDown}
        size={12}
        className="text-muted pointer-events-none absolute right-2"
      />
    </div>
  )
}

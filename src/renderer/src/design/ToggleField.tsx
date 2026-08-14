import { cn } from '@/helpers/cn'
import { FIELD_ROW, FOCUS_RING } from './styles'

export type ToggleFieldProps = {
  label: string
  value: boolean
  onChange: (value: boolean) => void
}

/**
 * A property that is on or off. It carries no gesture props: a checkbox changes once per
 * click, so there is no drag to coalesce into a single history entry.
 */
export function ToggleField({ label, value, onChange }: ToggleFieldProps) {
  return (
    <label className={FIELD_ROW}>
      {/* The full width of the row, unlike every other field's label, and the box goes to the far
          end: there is no control here to line up with the column the others share, and holding
          the label to that column truncated « Projette une ombre » to « Projette une … » while
          two thirds of the row stood empty beside it. Still titled, for the panel narrow enough
          that even this runs out — a label cut mid-word reads as a shorter one that means
          something else. */}
      <span title={label} className="text-muted min-w-0 flex-1 truncate">
        {label}
      </span>

      <input
        type="checkbox"
        checked={value}
        onChange={event => onChange(event.target.checked)}
        className={cn('accent-accent size-4 cursor-pointer', FOCUS_RING)}
      />
    </label>
  )
}

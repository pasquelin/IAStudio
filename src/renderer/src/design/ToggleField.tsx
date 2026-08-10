import { cn } from '@/helpers/cn'
import { FIELD_LABEL, FIELD_ROW, FOCUS_RING } from './styles'

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
      {/* Titled because the column truncates at four rems, exactly as `PropertyRow` learned to
          be: seen on screen, « Sortie du workflow » read « Sortie du … », which on a canvas whose
          nodes already carry a port labelled « Sortie » says the wrong thing rather than half of
          the right one. */}
      <span title={label} className={FIELD_LABEL}>
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

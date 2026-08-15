import { FIELD_LABEL_WIDE, FIELD_ROW } from './styles'

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
      {/* The wide label, and the only field that wears it: a checkbox sits at the far end of the
          row whatever its name does, so there is no control here to line up on the shared column
          — see `FIELD_LABEL_WIDE`, which says what that cost. */}
      <span title={label} className={FIELD_LABEL_WIDE}>
        {label}
      </span>

      <input
        type="checkbox"
        checked={value}
        onChange={event => onChange(event.target.checked)}
        className="accent-accent size-4 cursor-pointer"
      />
    </label>
  )
}

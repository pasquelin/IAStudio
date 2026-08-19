import { PropertyLabel } from './PropertyLabel'
import { CHECKBOX, FIELD_ROW } from './styles'
import { cn } from '@/helpers/cn'

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
      {/* The wide gauge, and the only field that asks for it: a checkbox sits at the far end of
          the row whatever its name does, so there is no control here to line up on the column. */}
      <PropertyLabel label={label} wide />

      <input
        type="checkbox"
        checked={value}
        onChange={event => onChange(event.target.checked)}
        className={cn(CHECKBOX, 'size-4')}
      />
    </label>
  )
}

import { Chip } from './Chip'
import { FieldActions } from './FieldActions'
import { PropertyLabel } from './PropertyLabel'
import { FIELD_ROW } from './styles'

export type Choice<T extends string> = {
  value: T
  label: string
  /** What picking it does. The label is on screen, so this explains instead of repeating it. */
  hint: string
}

export type ChoiceFieldProps<T extends string> = {
  label: string
  /** `null` leaves every chip unpressed — a value none of the rows names. */
  value: T | null
  options: readonly Choice<T>[]
  onChange: (value: T) => void
  /** The handle the MCP steers this field by. Never a translated word. */
  scId?: string
}

/**
 * A property with a handful of named answers, as a row of chips rather than a select: these are
 * read as much as they are set, and a menu hides the answer behind a click. It wraps, so a long
 * list costs a second line rather than a horizontal scroll.
 */
export function ChoiceField<T extends string>({
  label,
  value,
  options,
  onChange,
  scId,
}: ChoiceFieldProps<T>) {
  return (
    <div className={FIELD_ROW}>
      <PropertyLabel label={label} />

      <div data-sc={scId && `field:${scId}`} className="flex min-w-0 flex-1 flex-wrap gap-2">
        {options.map(option => (
          <Chip
            key={option.value}
            label={option.label}
            hint={option.hint}
            selected={option.value === value}
            onClick={() => onChange(option.value)}
          />
        ))}
      </div>

      <FieldActions />
    </div>
  )
}

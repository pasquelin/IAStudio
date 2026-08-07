import { ColorField } from '@/design/ColorField'
import { NumberField } from '@/design/NumberField'
import { SliderField } from '@/design/SliderField'
import { TextField } from '@/design/TextField'
import { Vector3Field } from '@/design/Vector3Field'
import type { GestureProps } from '@/design/styles'
import { isVector3, type FieldValue, type PropertyField } from '@/engines/scene/property-fields'

export type PropertyControlProps = {
  field: PropertyField
  label: string
  onChange: (value: FieldValue) => void
  gesture: GestureProps
}

/**
 * The control a field is rendered with. Chosen from the value's own shape, refined by the spec
 * — never from the name of a shape: a panel with a branch per primitive is the hand-written
 * form invariant 5 forbids.
 *
 * A field no table describes still renders, bare rather than dropped.
 */
export function PropertyControl({ field, label, onChange, gesture }: PropertyControlProps) {
  const { value, spec } = field

  if (typeof value === 'number') {
    if (spec?.control === 'slider') {
      return (
        <SliderField
          label={label}
          value={value}
          min={spec.min}
          max={spec.max}
          step={spec.step}
          onChange={onChange}
          {...gesture}
        />
      )
    }

    const { min, max } = spec?.control === 'number' ? spec : {}
    return (
      <NumberField
        label={label}
        value={value}
        min={min}
        max={max}
        step={spec?.control === 'number' ? spec.step : undefined}
        onChange={onChange}
        {...gesture}
      />
    )
  }

  if (isVector3(value)) {
    const step = spec?.control === 'vector3' ? spec.step : undefined
    return <Vector3Field label={label} value={value} step={step} onChange={onChange} {...gesture} />
  }

  // A hexadecimal is a colour whether or not a table said so — and anything else is text.
  if (spec?.control === 'color' || value.startsWith('#')) {
    return <ColorField label={label} value={value} onChange={onChange} {...gesture} />
  }

  return <TextField label={label} value={value} onChange={onChange} {...gesture} />
}

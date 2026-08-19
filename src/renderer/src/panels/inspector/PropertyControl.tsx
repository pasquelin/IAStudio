import { ColorField } from '@/design/ColorField'
import { NumberField } from '@/design/NumberField'
import { SliderField } from '@/design/SliderField'
import { TextField } from '@/design/TextField'
import { VectorField } from '@/design/VectorField'
import type { GestureProps } from '@/design/styles'
import { isVector3 } from '@shared/domain/scene'
import type { FieldValue, PropertyField } from '@/engines/scene/propertyFields'

export type PropertyControlProps = {
  field: PropertyField
  label: string
  onChange: (value: FieldValue) => void
  gesture: GestureProps
  /** What the section is called, in code. The field's own name completes it. */
  section: string
}

/**
 * The control a field is rendered with. Chosen from the value's own shape, refined by the spec
 * — never from the name of a shape: a panel with a branch per primitive is the hand-written
 * form invariant 5 forbids.
 *
 * A field no table describes still renders, bare rather than dropped.
 */
export function PropertyControl({
  field,
  label,
  onChange,
  gesture,
  section,
}: PropertyControlProps) {
  const { value, spec, fallback } = field
  // `field.name` is the descriptor's own key — never translated, which is exactly what a handle
  // must be. One line here names every parameter of every primitive, light and lens.
  const scId = `${section}.${field.name}`

  /**
   * Live only where the field has moved off what its factory gives — and only where a factory
   * could be found: a descriptor with none leaves the button drawn and inert rather than lying
   * about a default nobody can name.
   */
  const onReset =
    fallback === undefined || fallback === value ? undefined : () => onChange(fallback)

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
          scId={scId}
          onReset={onReset}
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
        scId={scId}
        onReset={onReset}
        {...gesture}
      />
    )
  }

  if (isVector3(value)) {
    const step = spec?.control === 'vector3' ? spec.step : undefined
    return (
      <VectorField
        label={label}
        value={value}
        step={step}
        onChange={onChange}
        scId={scId}
        defaults={isVector3(fallback) ? fallback : undefined}
        {...gesture}
      />
    )
  }

  // A hexadecimal is a colour whether or not a table said so — and anything else is text.
  if (spec?.control === 'color' || value.startsWith('#')) {
    return (
      <ColorField
        label={label}
        value={value}
        onChange={onChange}
        scId={scId}
        onReset={onReset}
        {...gesture}
      />
    )
  }

  return (
    <TextField
      label={label}
      value={value}
      onChange={onChange}
      scId={scId}
      onReset={onReset}
      {...gesture}
    />
  )
}

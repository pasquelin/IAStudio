import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { resetTo } from '@/helpers/resetTo'
import { ColorField } from '@/components/ColorField'
import { NumberField } from '@/components/NumberField'
import { SliderField } from '@/components/SliderField'
import { TextField } from '@/components/TextField'
import { SelectField } from '@/components/SelectField'
import { ToggleField } from '@/components/ToggleField'
import { VectorField } from '@/components/VectorField'
import { PictureField } from './PictureField/PictureField'
import type { GestureProps } from '@/components/styles'
import { isVector3 } from '@shared/domain/scene'
import type { FieldValue, PropertyField } from '@/engines/scene/propertyFields'

export type PropertyControlProps = {
  field: PropertyField
  label: string
  onChange: (value: FieldValue) => void
  gesture: GestureProps
  /** What the section is called, in code. The field's own name completes it. */
  section: string
  /** A button acting on the value, drawn before the reset — the keyframe diamond. */
  action?: ReactNode
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
  action,
}: PropertyControlProps) {
  const { t } = useTranslation()
  const { value, spec, fallback } = field
  // `field.name` is the descriptor's own key — never translated, which is exactly what a handle
  // must be. One line here names every parameter of every primitive, light and lens.
  const scId = `${section}.${field.name}`

  // A descriptor with no factory leaves the button inert rather than lying about a default.
  const onReset = resetTo(value, fallback, onChange)

  if (typeof value === 'boolean') {
    return (
      <ToggleField
        label={label}
        value={value}
        onChange={onChange}
        scId={scId}
        actions={action}
        onReset={onReset}
      />
    )
  }

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
          actions={action}
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
        actions={action}
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

  if (spec?.control === 'asset') {
    return (
      <PictureField
        label={label}
        value={value === '' ? null : value}
        onChange={assetId => onChange(assetId ?? '')}
        scId={scId}
      />
    )
  }

  if (spec?.control === 'choice') {
    return (
      <SelectField
        label={label}
        value={value}
        // The value itself when no translation exists, exactly as the label above falls back.
        options={spec.options.map(option => ({
          value: option,
          label: t(`${spec.labelPrefix}${option}`, option),
        }))}
        onChange={onChange}
        scId={scId}
        actions={action}
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
        actions={action}
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
      actions={action}
      {...gesture}
    />
  )
}

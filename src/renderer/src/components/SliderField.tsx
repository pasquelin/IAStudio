import type { FieldHandle, FieldReset } from './styles'
import type { ReactNode } from 'react'
import { bound } from '@shared/numeric'
import { Readout } from './Readout'
import { PropertyLine } from './PropertyLine'
import { ResetButton } from './ResetButton'
import { Slider } from './Slider'
import type { GestureProps } from './styles'

export type SliderFieldProps = GestureProps &
  FieldHandle &
  FieldReset & {
    label: string
    value: number
    min: number
    max: number
    step: number
    onChange: (value: number) => void
    /** Buttons for the row's end column, drawn before the reset — a padlock, say. */
    actions?: ReactNode
  }

/**
 * A bounded value — roughness, metalness, the penumbra of a spot. The number stays beside the
 * slider: "somewhere past the middle" is not a value anyone can write down.
 */
export function SliderField({
  label,
  value,
  min,
  max,
  step,
  onChange,
  scId,
  onReset,
  actions,
  onGestureStart,
  onGestureEnd,
}: SliderFieldProps) {
  return (
    <PropertyLine
      label={label}
      root="label"
      actions={
        <>
          {actions}
          <ResetButton onReset={onReset} />
        </>
      }
    >
      <Slider
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={raw => onChange(bound(raw, { min, max, step }))}
        scId={scId}
        onGestureStart={onGestureStart}
        onGestureEnd={onGestureEnd}
        className="flex-1"
      />

      <Readout values={[value]} />
    </PropertyLine>
  )
}

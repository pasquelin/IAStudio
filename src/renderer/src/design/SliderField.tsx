import type { ReactNode } from 'react'
import { bound } from '@shared/numeric'
import { FieldActions } from './FieldActions'
import { Readout } from './Readout'
import { PropertyLabel } from './PropertyLabel'
import { ResetButton } from './ResetButton'
import { Slider } from './Slider'
import { FIELD_ROW, type GestureProps } from './styles'

export type SliderFieldProps = GestureProps & {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  /** The handle the MCP steers this field by. Never a translated word. */
  scId?: string
  /** Puts the value back where it started. Absent while it already stands there. */
  onReset?: () => void
  /** One more button for the row’s end column, drawn before the reset — a padlock, say. */
  action?: ReactNode
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
  action,
  onGestureStart,
  onGestureEnd,
}: SliderFieldProps) {
  return (
    <label className={FIELD_ROW}>
      <PropertyLabel label={label} />

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

      <FieldActions>
        {action}
        <ResetButton onReset={onReset} />
      </FieldActions>
    </label>
  )
}

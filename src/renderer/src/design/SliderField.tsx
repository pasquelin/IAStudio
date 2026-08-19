import { bound } from '@shared/numeric'
import { FieldActions } from './FieldActions'
import { Readout } from './Readout'
import { PropertyLabel } from './PropertyLabel'
import { ResetButton } from './ResetButton'
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
  onGestureStart,
  onGestureEnd,
}: SliderFieldProps) {
  return (
    <label className={FIELD_ROW}>
      <PropertyLabel label={label} />

      <input
        type="range"
        data-sc={scId && `field:${scId}`}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={event => onChange(bound(Number(event.target.value), { min, max, step }))}
        // A slider drag is a pointer gesture from the first frame; keyboard steps report the
        // same way, and a focus that changes nothing costs an empty gesture, not an entry.
        onPointerDown={() => onGestureStart?.()}
        onPointerUp={() => onGestureEnd?.()}
        onFocus={() => onGestureStart?.()}
        onBlur={() => onGestureEnd?.()}
        className="accent-accent h-(--sc-control) min-w-0 flex-1"
      />

      <Readout values={[value]} />

      <FieldActions>
        <ResetButton onReset={onReset} />
      </FieldActions>
    </label>
  )
}

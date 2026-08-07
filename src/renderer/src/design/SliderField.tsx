import { cn } from '@/helpers/cn'
import { bound } from '@/helpers/numeric'
import { FIELD_LABEL, FIELD_ROW, FOCUS_RING, type GestureProps } from './styles'

export type SliderFieldProps = GestureProps & {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
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
  onGestureStart,
  onGestureEnd,
}: SliderFieldProps) {
  return (
    <label className={FIELD_ROW}>
      <span className={FIELD_LABEL}>{label}</span>

      <input
        type="range"
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
        className={cn('accent-accent h-(--sc-control) min-w-0 flex-1', FOCUS_RING)}
      />

      {/* Tabular figures: without them the row twitches sideways as the digits change. */}
      <output className="text-muted w-10 shrink-0 text-right tabular-nums">{value}</output>
    </label>
  )
}

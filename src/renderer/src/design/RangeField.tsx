import { cn } from '@/helpers/cn'
import { bound } from '@shared/numeric'
import { Readout } from './Readout'
import { PropertyLabel } from './PropertyLabel'
import { FIELD_ROW, type GestureProps } from './styles'

/** Both ends of one value, kept in order. Declared here rather than imported from an engine:
 * `design/` describes controls, and a field that reached into a workspace would tie the two. */
export type RangeValue = { min: number; max: number }

/**
 * Pointer events are off on the inputs and back on for their handles: stacked on one rail, the
 * upper input would otherwise swallow every press meant for the lower one.
 *
 * At module scope because it depends on nothing, and this field sits on the drag path twice.
 */
const HANDLE = cn(
  'absolute inset-0 m-0 h-full w-full appearance-none bg-transparent pointer-events-none',
  '[&::-webkit-slider-thumb]:pointer-events-auto [&::-moz-range-thumb]:pointer-events-auto',
  'accent-accent',
)

export type RangeFieldProps = GestureProps & {
  label: string
  value: RangeValue
  min: number
  max: number
  step: number
  /** Names the two handles for a screen reader — «from» and «to», in the caller's language. */
  fromLabel: string
  toLabel: string
  onChange: (value: RangeValue) => void
}

/**
 * Two handles on one rail: what a roughness map holds gets read as *this* much to *that* much,
 * which is how a flat generated channel becomes a material. One rail rather than two sliders,
 * because the value being set is the span between them, not two numbers that happen to be near.
 *
 * Handles are allowed to meet and not to cross: a range whose ends swapped would remap the whole
 * map to nothing, silently — the same reason `readRange` holds the order when a file is read.
 */
export function RangeField({
  label,
  value,
  min,
  max,
  step,
  fromLabel,
  toLabel,
  onChange,
  onGestureStart,
  onGestureEnd,
}: RangeFieldProps) {
  const span = max - min
  const percent = (edge: number): number => ((edge - min) / span) * 100

  // Stacked inputs: «to» is last in the DOM, so it takes the press wherever the two meet. Only
  // at the ceiling is that a trap — «to» has nowhere to drag to, so it cannot part them. Lifting
  // «from» any earlier would take the presses «to» still needs to widen the span upwards.
  const fromOnTop = value.max >= max

  const set = (edge: 'min' | 'max', raw: number): void => {
    const next = bound(raw, { min, max, step })
    // Clamped against the other handle rather than refused: a drag that ran past it stops there,
    // which is what a pointer already dragging expects to feel.
    onChange(
      edge === 'min'
        ? { min: Math.min(next, value.max), max: value.max }
        : { min: value.min, max: Math.max(next, value.min) },
    )
  }

  return (
    <div className={FIELD_ROW}>
      <PropertyLabel label={label} />

      <div
        className="relative h-(--sc-control) min-w-0 flex-1"
        onPointerDown={() => onGestureStart?.()}
        onPointerUp={() => onGestureEnd?.()}
      >
        {/* The rail and the span, drawn behind both inputs — decoration, never a target. */}
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2">
          <div className="bg-surface size-full rounded-full" />
          <div
            className="bg-accent absolute inset-y-0 rounded-full"
            style={{
              left: `${percent(value.min)}%`,
              width: `${percent(value.max) - percent(value.min)}%`,
            }}
          />
        </div>

        <input
          type="range"
          aria-label={fromLabel}
          value={value.min}
          min={min}
          max={max}
          step={step}
          onChange={event => set('min', Number(event.target.value))}
          onFocus={() => onGestureStart?.()}
          onBlur={() => onGestureEnd?.()}
          className={cn(HANDLE, fromOnTop && 'z-1')}
        />
        <input
          type="range"
          aria-label={toLabel}
          value={value.max}
          min={min}
          max={max}
          step={step}
          onChange={event => set('max', Number(event.target.value))}
          onFocus={() => onGestureStart?.()}
          onBlur={() => onGestureEnd?.()}
          className={HANDLE}
        />
      </div>

      <Readout values={[value.min, value.max]} />
    </div>
  )
}

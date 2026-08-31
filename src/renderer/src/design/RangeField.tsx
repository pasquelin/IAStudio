import { cn } from '@/helpers/cn'
import { bound } from '@shared/numeric'
import { Readout } from './Readout'
import { PropertyLine } from './PropertyLine'
import { SliderHandle } from './SliderHandle'
import { SliderRail } from './SliderRail'
import { SLIDER_TRACK, type GestureProps } from './styles'

/** Both ends of one value, kept in order. Declared here rather than imported from an engine:
 * `design/` describes controls, and a field that reached into a workspace would tie the two. */
export type RangeValue = { min: number; max: number }

/**
 * Pointer events are off on the inputs and back on for their handles: stacked on one rail, the
 * upper input would otherwise swallow every press meant for the lower one.
 *
 * At module scope because it depends on nothing, and this field sits on the drag path twice.
 */
const HANDLE = 'pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto'

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
  /** The handle the MCP steers this field by; each end extends it with its own word. */
  scId?: string
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
  scId,
  onGestureStart,
  onGestureEnd,
}: RangeFieldProps) {
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
    // `div`, never a wrapping label: it could bind only the first of the two handles.
    <PropertyLine label={label} root="div">
      <div
        className={cn(SLIDER_TRACK, 'flex-1')}
        onPointerDown={() => onGestureStart?.()}
        onPointerUp={() => onGestureEnd?.()}
      >
        <SliderRail from={value.min} to={value.max} min={min} max={max} />

        <SliderHandle
          label={fromLabel}
          scId={scId && `${scId}.min`}
          value={value.min}
          min={min}
          max={max}
          step={step}
          onChange={raw => set('min', raw)}
          onGestureStart={onGestureStart}
          onGestureEnd={onGestureEnd}
          className={cn(HANDLE, fromOnTop && 'z-1')}
        />
        <SliderHandle
          label={toLabel}
          scId={scId && `${scId}.max`}
          value={value.max}
          min={min}
          max={max}
          step={step}
          onChange={raw => set('max', raw)}
          onGestureStart={onGestureStart}
          onGestureEnd={onGestureEnd}
          className={HANDLE}
        />
      </div>

      <Readout values={[value.min, value.max]} />
    </PropertyLine>
  )
}

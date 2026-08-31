import { cn } from '@/helpers/cn'
import { fieldHandle } from './scHandle'
import { SLIDER_HANDLE, type GestureProps } from './styles'

export type SliderHandleProps = GestureProps & {
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step: number
  /** Names the input where nothing visible does — each end of a span says which one it is. */
  label?: string
  id?: string
  describedBy?: string
  /** The handle the MCP steers this control by, a span's end having already added its own word. */
  scId?: string
  /** Laid over the shared skin: `RangeField` stacks two of these on one rail and lifts one. */
  className?: string
}

/**
 * The `<input type="range">` of the studio, and the only one. What a PRESS opens belongs to the
 * track this sits on, never here: `RangeField` stacks two handles transparent to the pointer but
 * for their thumbs, so only the track sees every press.
 */
export function SliderHandle({
  value,
  onChange,
  min,
  max,
  step,
  label,
  id,
  describedBy,
  scId,
  className,
  onGestureStart,
  onGestureEnd,
}: SliderHandleProps) {
  return (
    <input
      type="range"
      id={id}
      aria-label={label}
      aria-describedby={describedBy}
      data-sc={scId && fieldHandle(scId)}
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={event => onChange(Number(event.target.value))}
      // 🛑 The KEY and never the focus. A gesture is keyed by document, and a drag leaves the
      // handle focused: the blur landed on the next press elsewhere and closed the gesture that
      // press had just opened, turning every frame of it into an undo entry of its own.
      onKeyDown={() => onGestureStart?.()}
      onKeyUp={() => onGestureEnd?.()}
      className={cn(SLIDER_HANDLE, className)}
    />
  )
}

import { cn } from '@/helpers/cn'
import { SliderRail } from './SliderRail'
import { SLIDER_HANDLE, SLIDER_TRACK, type GestureProps } from './styles'

export type SliderProps = GestureProps & {
  value: number
  onChange: (value: number) => void
  /** The input's own defaults, so the rail knows the span the browser would assume anyway. */
  min?: number
  max?: number
  step?: number
  id?: string
  describedBy?: string
  /** The handle the MCP steers this control by. Never a translated word. */
  scId?: string
  /** How wide the control sits: a share of its row here, a fixed column in a settings window. */
  className?: string
}

/** One value along a rail. The number itself belongs to the host, which prints it beside. */
export function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  id,
  describedBy,
  scId,
  className,
  onGestureStart,
  onGestureEnd,
}: SliderProps) {
  return (
    <div className={cn(SLIDER_TRACK, className)}>
      <SliderRail from={min} to={value} min={min} max={max} />

      <input
        type="range"
        id={id}
        aria-describedby={describedBy}
        data-sc={scId && `field:${scId}`}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={event => onChange(Number(event.target.value))}
        // A slider drag is a pointer gesture from the first frame; keyboard steps report the
        // same way, and a focus that changes nothing costs an empty gesture, not an entry.
        onPointerDown={() => onGestureStart?.()}
        onPointerUp={() => onGestureEnd?.()}
        onFocus={() => onGestureStart?.()}
        onBlur={() => onGestureEnd?.()}
        className={SLIDER_HANDLE}
      />
    </div>
  )
}

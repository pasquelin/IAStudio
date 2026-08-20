import { cn } from '@/helpers/cn'
import { SliderHandle } from './SliderHandle'
import { SliderRail } from './SliderRail'
import { SLIDER_TRACK, type GestureProps } from './styles'

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
    // A slider drag is a pointer gesture from the first frame. Taken on the track rather than on
    // the handle, as `RangeField` takes it: the handle covers this box entirely, so the press
    // reaches here either way, and both sliders then open a gesture the same way.
    <div
      className={cn(SLIDER_TRACK, className)}
      onPointerDown={() => onGestureStart?.()}
      onPointerUp={() => onGestureEnd?.()}
    >
      <SliderRail from={min} to={value} min={min} max={max} />

      <SliderHandle
        value={value}
        onChange={onChange}
        min={min}
        max={max}
        step={step}
        id={id}
        describedBy={describedBy}
        scId={scId}
        onGestureStart={onGestureStart}
        onGestureEnd={onGestureEnd}
      />
    </div>
  )
}

import { cn } from '@/helpers/cn'
import { SliderRail } from './SliderRail'
import type { GestureProps } from './styles'

export type SliderProps = GestureProps & {
  value: number
  onChange: (value: number) => void
  /** The input's own defaults, so the rail knows the span the browser would assume anyway. */
  min?: number
  max?: number
  step?: number
  id?: string
  describedBy?: string
  /** Named by whatever wraps it — a `<label>` around the field, or this when nothing does. */
  ariaLabel?: string
  /** The handle the MCP steers this control by. Never a translated word. */
  scId?: string
  /** How wide the control sits: a share of its row here, a fixed column in a settings window. */
  className?: string
}

/**
 * One value along a rail, in the studio's own dress rather than the browser's. The value is not
 * read out here: a slider alone says «somewhere past the middle», and every host pairs it with
 * a number of its own — a `Readout` in a panel, a formatted caption in the settings window.
 */
export function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  id,
  describedBy,
  ariaLabel,
  scId,
  className,
  onGestureStart,
  onGestureEnd,
}: SliderProps) {
  return (
    <div className={cn('relative h-(--sc-control) min-w-0', className)}>
      <SliderRail from={0} to={((value - min) / (max - min)) * 100} />

      <input
        type="range"
        id={id}
        aria-describedby={describedBy}
        aria-label={ariaLabel}
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
        className="slider-handle absolute inset-0 m-0 size-full"
      />
    </div>
  )
}

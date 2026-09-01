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

/** What a range input answers to by moving. Tab and Escape are not among them, deliberately. */
const STEPPING_KEYS: ReadonlySet<string> = new Set([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'PageUp',
  'PageDown',
  'Home',
  'End',
])

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
      // 🛑 The keys that MOVE the value, and only them. Never the focus: a drag leaves the handle
      // focused, and the blur landed on the next press elsewhere, closing the gesture that press
      // had just opened. Never Tab either — it moves the focus on the keydown, so its keyup lands
      // on the next control and the gesture would stay open for the life of the document.
      onKeyDown={event => {
        // `repeat` skipped: `beginGesture` rearms the merge target, so a held arrow would cost
        // one undo entry per repeat instead of one for the whole run.
        if (STEPPING_KEYS.has(event.key) && !event.repeat) onGestureStart?.()
      }}
      onKeyUp={event => {
        if (STEPPING_KEYS.has(event.key)) onGestureEnd?.()
      }}
      className={cn(SLIDER_HANDLE, className)}
    />
  )
}

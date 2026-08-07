import {
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { cn } from '@/helpers/cn'
import { bound, type NumericBounds } from '@/helpers/numeric'
import { FIELD } from './styles'

export type NumberFieldProps = NumericBounds & {
  label: string
  value: number
  onChange: (value: number) => void
  /**
   * Both ends of one gesture. Everything the field emits between them is one thing the user
   * did, and the history is expected to keep exactly one entry for it.
   */
  onGestureStart?: () => void
  onGestureEnd?: () => void
  /** `inline` shrinks the label to the width of an axis letter, for the fields of a vector. */
  layout?: 'row' | 'inline'
}

/** Units per pixel dragged, for a field that declares no step of its own. */
const DEFAULT_STEP = 0.1

type Drag = { pointerId: number; x: number; from: number }

/**
 * A number that can be typed or dragged sideways on its label — the gesture of Blender and of
 * Unity, and what makes a viewport adjustable instead of merely fillable. Dragging the label
 * rather than the field leaves the field itself free to be clicked into and typed in.
 *
 * It knows nothing of scenes or of history: it reports where a gesture starts and ends, and
 * whoever owns the value decides what that means.
 */
export function NumberField({
  label,
  value,
  min,
  max,
  step,
  onChange,
  onGestureStart,
  onGestureEnd,
  layout = 'row',
}: NumberFieldProps) {
  const drag = useRef<Drag | null>(null)
  /**
   * What is in the field while it is being typed in. Held apart from `value` so a half-written
   * number survives the render its own keystroke causes: "0." parses to 0, and echoing the
   * parsed value back would eat the dot as it is typed.
   */
  const [typed, setTyped] = useState<string | null>(null)

  const bounds: NumericBounds = { min, max, step }

  const emit = (raw: number): void => {
    if (Number.isFinite(raw)) onChange(bound(raw, bounds))
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLSpanElement>): void => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { pointerId: event.pointerId, x: event.clientX, from: value }
    onGestureStart?.()
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLSpanElement>): void => {
    const started = drag.current
    if (!started || started.pointerId !== event.pointerId) return
    // From where the drag began rather than from the current value: accumulating deltas drifts,
    // because each one is snapped to the step before it comes back.
    emit(started.from + (event.clientX - started.x) * (step ?? DEFAULT_STEP))
  }

  const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>): void => {
    const direction = event.key === 'ArrowUp' ? 1 : event.key === 'ArrowDown' ? -1 : 0
    if (direction === 0) return
    event.preventDefault()
    // Typed text is dropped rather than stepped from: half a number has no successor.
    setTyped(null)
    emit(value + direction * (step ?? DEFAULT_STEP))
  }

  const endDrag = (event: ReactPointerEvent<HTMLSpanElement>): void => {
    if (drag.current?.pointerId !== event.pointerId) return
    drag.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
    onGestureEnd?.()
  }

  return (
    <div className="flex min-w-0 items-center gap-1 text-[11px]">
      {/*
        The label is the drag handle, and deliberately not a `<label>` bound to the field:
        clicking a bound label focuses what it names, so every drag would leave the field in
        edit mode. It carries no name for assistive tech either — the input holds that, and
        the arrow keys are the keyboard's version of the gesture.
      */}
      <span
        aria-hidden
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={cn(
          'text-muted shrink-0 cursor-ew-resize touch-none select-none',
          layout === 'row' ? 'w-16 truncate' : '',
        )}
      >
        {label}
      </span>

      {/*
        Text rather than `number`: an input of that type discards what it cannot parse, so "0."
        comes back empty and the dot is eaten as it is typed. It also carries spinners no studio
        wants — the arrow keys below give back what they were for.
      */}
      <input
        type="text"
        inputMode="decimal"
        role="spinbutton"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        value={typed ?? String(value)}
        onChange={event => {
          setTyped(event.target.value)
          emit(Number(event.target.value))
        }}
        onKeyDown={onKeyDown}
        // Typing is a gesture too: a field filled in character by character must cost one undo,
        // not one per keystroke.
        onFocus={() => onGestureStart?.()}
        onBlur={() => {
          setTyped(null)
          onGestureEnd?.()
        }}
        className={cn(FIELD, 'w-full min-w-0 flex-1 text-[11px]')}
      />
    </div>
  )
}

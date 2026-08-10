import {
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { cn } from '@/helpers/cn'
import { bound, type NumericBounds } from '@shared/numeric'
import { FIELD, FIELD_LABEL, FIELD_ROW, type GestureProps } from './styles'

export type NumberFieldProps = NumericBounds &
  GestureProps & {
    label: string
    value: number
    onChange: (value: number) => void
    /** `inline` shrinks the label to the width of an axis letter, for a vector's three fields. */
    layout?: 'row' | 'inline'
  }

/** Units per pixel dragged, for a field that declares no step of its own. */
const DEFAULT_STEP = 0.1

type Drag = { pointerId: number; x: number; from: number; last: number }

/**
 * A number that can be typed, stepped with the arrows, or dragged sideways on its label — the
 * gesture of Blender and of Unity. It knows nothing of scenes or of history: it reports a value
 * and the two ends of a gesture, and whoever owns the value decides what that means.
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

  const emit = (raw: number): void => {
    if (!Number.isFinite(raw)) return
    const next = bound(raw, { min, max, step })
    if (next !== value) onChange(next)
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLSpanElement>): void => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { pointerId: event.pointerId, x: event.clientX, from: value, last: value }
    onGestureStart?.()
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLSpanElement>): void => {
    const started = drag.current
    if (!started || started.pointerId !== event.pointerId) return

    // From where the drag began rather than from the current value: accumulating deltas drifts,
    // because each one is snapped to the step before it comes back.
    const next = bound(started.from + (event.clientX - started.x) * (step ?? DEFAULT_STEP), {
      min,
      max,
      step,
    })
    // A drag crosses many pixels per step, and a vertical one crosses none. Compared against
    // what the drag last emitted, not the prop: several moves can land before React re-renders,
    // and each repeat would rebuild the geometry and the whole panel for the same number.
    if (next === started.last) return

    started.last = next
    onChange(next)
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
    <div className={FIELD_ROW}>
      {/* Deliberately not a `<label>` bound to the field: a bound label focuses what it names,
          so every drag would leave the field in edit mode. The input carries the name. */}
      <span
        aria-hidden
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        title={label}
        className={cn(
          'text-muted shrink-0 cursor-ew-resize touch-none select-none',
          layout === 'row' && FIELD_LABEL,
        )}
      >
        {label}
      </span>

      {/* Text rather than `number`, which discards what it cannot parse: "0." would come back
          empty and the dot would be eaten as it is typed. */}
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
          const text = event.target.value
          setTyped(text)
          // An emptied field is not zero: `Number('')` is, and emitting it would crush the mesh
          // to its minimum between the moment a value is cleared and the moment one is typed.
          if (text.trim() !== '') emit(Number(text))
        }}
        onKeyDown={onKeyDown}
        // Typing is a gesture too: a field filled in character by character must cost one undo,
        // not one per keystroke.
        onFocus={() => onGestureStart?.()}
        onBlur={() => {
          setTyped(null)
          onGestureEnd?.()
        }}
        className={cn(FIELD, 'min-w-0 flex-1 text-[11px]')}
      />
    </div>
  )
}

import {
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/helpers/cn'
import { formatDecimal, parseDecimal } from '@/helpers/format'
import { bound, type NumericBounds } from '@shared/numeric'
import { PropertyLabel } from './PropertyLabel'
import { ResetButton } from './ResetButton'
import { FIELD_FILL, FIELD_ROW, type GestureProps } from './styles'

export type NumberFieldProps = NumericBounds &
  GestureProps & {
    label: string
    value: number
    onChange: (value: number) => void
    /** `inline` shrinks the label to the width of an axis letter, for a vector's three fields. */
    layout?: 'row' | 'inline'
    /**
     * Stripes the field's leading edge in the axis colour. Named rather than derived from the
     * label: `X` is the letter in every language, but a caller could pass anything.
     */
    axis?: 'x' | 'y' | 'z'
    /**
     * Inert but still drawn — the row keeps its place in the panel rather than vanishing, so an
     * attribute is always found where it was last seen. Whoever disables one owes the reader a
     * `hint` saying why: a control refused without a reason is worse than one that is absent.
     */
    disabled?: boolean
    /** Tooltip attributes from the host's own factory, already resolved. */
    hint?: Record<string, string>
    /** The handle the MCP steers this field by. Never a translated word. */
    scId?: string
    /** Puts the value back where it started. Absent while it already stands there. */
    onReset?: () => void
  }

/** Units per pixel dragged, for a field that declares no step of its own. */
const DEFAULT_STEP = 0.1

/**
 * How far the pointer travels on the INPUT before the press is a scrub rather than a click. Under
 * it the caret is placed, over it the value is dragged and the field never takes focus — the
 * arbitration Unreal makes, and the only way one control can serve both gestures.
 */
const SCRUB_SLACK = 4

/** `scrubbing` is false while a press on the input is still short of `SCRUB_SLACK`. */
type Drag = { pointerId: number; x: number; from: number; last: number; scrubbing: boolean }

/**
 * A number that can be typed, stepped with the arrows, or dragged sideways — on its label, and on
 * the field itself. It knows nothing of scenes or of history: it reports a value and the two ends
 * of a gesture, and whoever owns the value decides what that means.
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
  axis,
  disabled,
  hint,
  scId,
  onReset,
}: NumberFieldProps) {
  const drag = useRef<Drag | null>(null)
  /**
   * What is in the field while it is being typed in. Held apart from `value` so a half-written
   * number survives the render its own keystroke causes: "0." parses to 0, and echoing the
   * parsed value back would eat the dot as it is typed.
   */
  const [typed, setTyped] = useState<string | null>(null)
  const { i18n } = useTranslation()

  /**
   * The value as this reader writes one, and ungrouped on purpose: a separator inside the field
   * would have to be stripped back out on the way in, and a thousand is not what a coordinate
   * field is read for. Every digit is kept — this is a field, not a readout.
   */
  // `value === 0` rather than `value`: a step landing on zero from below gives `-0`, which
  // `String` hid and `Intl` writes out. A field reading `-0` is the same defect the ruler names.
  const shown = formatDecimal(value === 0 ? 0 : value, i18n.language, {
    digits: 20,
    grouped: false,
  })

  const emit = (raw: number): void => {
    if (!Number.isFinite(raw)) return
    const next = bound(raw, { min, max, step })
    if (next !== value) onChange(next)
  }

  /** `scrubbing` from the first pixel on the label, from `SCRUB_SLACK` on the field. */
  const startDrag = (event: ReactPointerEvent<Element>, scrubbing: boolean): void => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      from: value,
      last: value,
      scrubbing,
    }
    if (scrubbing) onGestureStart?.()
  }

  const onPointerMove = (event: ReactPointerEvent<Element>): void => {
    const started = drag.current
    if (!started || started.pointerId !== event.pointerId) return

    const travelled = event.clientX - started.x
    if (!started.scrubbing) {
      if (Math.abs(travelled) < SCRUB_SLACK) return
      started.scrubbing = true
      onGestureStart?.()
    }

    // From where the drag began rather than from the current value: accumulating deltas drifts,
    // because each one is snapped to the step before it comes back.
    const next = bound(started.from + travelled * (step ?? DEFAULT_STEP), { min, max, step })
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

  const endDrag = (event: ReactPointerEvent<Element>): void => {
    const started = drag.current
    if (started?.pointerId !== event.pointerId) return
    drag.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
    if (started.scrubbing) onGestureEnd?.()
  }

  /**
   * A press that never travelled is a click: the field takes focus and the caret lands, which the
   * `preventDefault` below withheld. One that scrubbed does NOT — leaving the field in edit mode
   * after a drag is what made the two gestures fight for one control in the first place.
   */
  const endFieldDrag = (event: ReactPointerEvent<HTMLInputElement>): void => {
    const scrubbed = drag.current?.scrubbing === true
    const field = event.currentTarget
    endDrag(event)
    if (!scrubbed) field.focus()
  }

  /** No slack on the name: it has no second gesture to be told apart from. */
  const scrub = {
    onPointerDown: disabled ? undefined : (event: ReactPointerEvent) => startDrag(event, true),
    onPointerMove,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
  }
  const scrubSkin = cn(
    'touch-none select-none',
    disabled ? 'cursor-not-allowed' : 'cursor-ew-resize',
  )

  return (
    <div className={FIELD_ROW}>
      {/* Deliberately not a `<label>` bound to the field: a bound label focuses what it names,
          so every drag would leave the field in edit mode. The input carries the name. */}
      {layout === 'row' ? (
        <PropertyLabel label={label} hidden gesture={scrub} className={scrubSkin} />
      ) : (
        <span aria-hidden title={label} {...scrub} className={cn('text-muted shrink-0', scrubSkin)}>
          {label}
        </span>
      )}

      {/* Text rather than `number`, which discards what it cannot parse: "0." would come back
          empty and the dot would be eaten as it is typed. */}
      <input
        type="text"
        inputMode="decimal"
        role="spinbutton"
        aria-label={label}
        aria-valuenow={value}
        // The number and the way it is written parted company the day this field localised
        // itself: a screen reader speaks `aria-valuenow`, and `0.5` is not what the screen says.
        aria-valuetext={shown}
        aria-valuemin={min}
        aria-valuemax={max}
        value={typed ?? shown}
        onChange={event => {
          const text = event.target.value
          setTyped(text)
          // An emptied field is not zero: `Number('')` is, and emitting it would crush the mesh
          // to its minimum between the moment a value is cleared and the moment one is typed.
          if (text.trim() !== '') emit(parseDecimal(text))
        }}
        onKeyDown={onKeyDown}
        /**
         * Armed only while the field is NOT being typed in: once the caret is in, a press is a
         * press on text — selecting a digit to overwrite it must not drag the value away.
         */
        disabled={disabled}
        {...hint}
        onPointerDown={event => {
          if (document.activeElement === event.currentTarget) return
          // Withholds the focus the platform would give now, so a drag never lands in edit mode.
          // `endFieldDrag` hands it back when the press turns out to have been a click.
          event.preventDefault()
          startDrag(event, false)
        }}
        onPointerMove={onPointerMove}
        onPointerUp={endFieldDrag}
        onPointerCancel={endDrag}
        // Typing is a gesture too: a field filled in character by character must cost one undo,
        // not one per keystroke.
        onFocus={() => onGestureStart?.()}
        onBlur={() => {
          setTyped(null)
          onGestureEnd?.()
        }}
        data-sc={scId && `field:${scId}`}
        // The scrub cursor is what makes the gesture discoverable at all — and it gives way to
        // the caret on focus, for the same reason the press does: a field being typed in is text.
        className={cn(
          FIELD_FILL,
          'touch-none',
          // A disabled control is exempt from the contrast of WCAG 1.4.3, which is what lets the
          // row stay legible as a row while saying it cannot be touched.
          disabled ? 'text-muted cursor-not-allowed' : 'cursor-ew-resize focus:cursor-text',
          // A stripe, not a whole border: the field keeps its own edge, and what changes is the
          // side the eye scans down a column of three.
          axis && 'border-l-2',
          axis === 'x' && 'border-l-axis-x',
          axis === 'y' && 'border-l-axis-y',
          axis === 'z' && 'border-l-axis-z',
        )}
      />

      {/* Never inside a vector's grid: the three axes share one reset, drawn by `VectorField` at
          the end of their line, or a Position row would end with three identical buttons. */}
      {layout === 'row' && <ResetButton onReset={onReset} />}
    </div>
  )
}

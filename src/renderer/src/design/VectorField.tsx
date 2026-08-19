import {
  mdiChevronDown,
  mdiChevronRight,
  mdiLink,
  mdiLinkOff,
  mdiLock,
  mdiLockOpenVariantOutline,
} from '@mdi/js'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { NumericBounds } from '@shared/numeric'
import { HINT_LEFT, TIP_LEFT } from '@/helpers/tooltip'
import { NumberField } from './NumberField'
import { PropertyLabel } from './PropertyLabel'
import { ResetButton } from './ResetButton'
import { FieldActions } from './FieldActions'
import { FIELD_ROW, type GestureProps } from './styles'
import { ToolButton } from './ToolButton'
import { UiIcon } from './UiIcon'

/** A position or a rotation, or the two components of a repeat. `z` absent means two axes. */
export type AxisValue = { x: number; y: number; z?: number }

export type VectorFieldProps<V extends AxisValue> = NumericBounds &
  GestureProps & {
    label: string
    value: V
    onChange: (value: V) => void
    /** The handle the MCP steers this vector by; each axis extends it with its own letter. */
    scId?: string
    /** Inert but still drawn — see `NumberField`, which owes the reader the `hint` that says why. */
    disabled?: boolean
    hint?: Record<string, string>
    /**
     * Offers a padlock that keeps the axes in proportion. For a SCALE and little else: locking a
     * position would drag a node along a diagonal through the origin, which is not a gesture.
     */
    lockable?: boolean
    /**
     * Where this vector RESTS: the whole of it from the folded row, one axis at a time from each
     * unfolded one. A value and not a callback, so the per-axis reset needs no second prop.
     */
    defaults?: V
    /**
     * The axes held still. Their field is inert and their padlock closed — the caller is what
     * makes the hold bite everywhere else, this only draws it.
     */
    heldAxes?: readonly (keyof AxisValue)[]
    /** Offers a padlock per axis, on the unfolded lines alone: a folded row has no room for three. */
    onHoldAxis?: (axis: keyof AxisValue, held: boolean) => void
  }

const XYZ: readonly (keyof AxisValue)[] = ['x', 'y', 'z']

/**
 * The components of a position, a rotation, a scale or a repeat. Each axis is a `NumberField` of
 * its own, so each one drags on its own field — and the axis names are not translated: X, Y and
 * Z are what every 3D application calls them, in every language.
 *
 * Two axes or three, read off the value: a tiling has two, and a second component built for it
 * would have been this one with a line removed.
 */
export function VectorField<V extends AxisValue>({
  label,
  value,
  onChange,
  onGestureStart,
  onGestureEnd,
  scId,
  disabled,
  hint,
  lockable,
  defaults,
  heldAxes,
  onHoldAxis,
  ...bounds
}: VectorFieldProps<V>) {
  const { t } = useTranslation()
  const [stacked, setStacked] = useState(false)
  const [locked, setLocked] = useState(false)
  /**
   * What the axes stood at when the padlock closed, and the ONLY thing the ratio is read from.
   * Recomputing it against the live value would compound every keystroke of a drag, and an axis
   * taken to zero would flatten the other two with no way back.
   */
  const held = useRef<V | null>(null)

  // Read off the value rather than declared: a tiling has two components and a transform three,
  // and the shape of the value is the only place that fact already lives.
  const shown = XYZ.filter(axis => value[axis] !== undefined)

  const lock = (): void => {
    held.current = locked ? null : value
    setLocked(!locked)
  }

  /**
   * And RECAPTURED at the start of every gesture, which the padlock alone could not do: this
   * component keeps its place in the tree across selections, so a padlock closed over a cube of
   * (1, 2, 4) went on scaling the NEXT cube by that ratio — typing 2 into a (1, 1, 1) gave
   * (2, 4, 8). Undo and the reset button replace the value the same silent way.
   */
  const beginGesture = (): void => {
    if (locked) held.current = value
    onGestureStart?.()
  }

  const move = (axis: keyof AxisValue, next: number): void => {
    const from = held.current
    // Nothing to scale FROM at zero: the axis moves alone rather than taking the others to zero
    // with it, which is the one case a ratio cannot express.
    if (!locked || !from || (from[axis] ?? 0) === 0) return onChange({ ...value, [axis]: next })

    const factor = next / (from[axis] ?? 1)
    const scaled = Object.fromEntries(shown.map(one => [one, (from[one] ?? 0) * factor]))
    onChange({ ...value, ...scaled })
  }

  // One place that knows what "this axis has moved" means: read two ways, a missing axis counted
  // as zero on one side and written as `undefined` on the other.
  const moved = (axis: keyof AxisValue): boolean =>
    defaults !== undefined && (value[axis] ?? 0) !== (defaults[axis] ?? 0)

  // Straight through `onChange`, never through `move`: `move` is where the padlock multiplies, and
  // a reset dragging the other two axes with it would not be one.
  const resetOf = (axis: keyof AxisValue): (() => void) | undefined =>
    moved(axis) ? () => onChange({ ...value, [axis]: defaults?.[axis] ?? 0 }) : undefined

  const resetAll = defaults && shown.some(moved) ? () => onChange(defaults) : undefined

  const isHeld = (axis: keyof AxisValue): boolean => (heldAxes ?? []).includes(axis)

  const axisField = (axis: keyof AxisValue, layout: 'row' | 'inline') => (
    <NumberField
      key={axis}
      layout={layout}
      axis={axis}
      // Held axes refuse the caret and the scrub alike: what the command refuses, the field must
      // not pretend to offer.
      disabled={disabled || isHeld(axis)}
      hint={isHeld(axis) ? HINT_LEFT(t('inspector.axisHeldHint')) : undefined}
      scId={scId && `${scId}.${axis}`}
      label={axis.toUpperCase()}
      value={value[axis] ?? 0}
      onChange={next => move(axis, next)}
      // Only where an axis has a line of its own to end; folded, the three share the row's.
      onReset={layout === 'row' ? resetOf(axis) : undefined}
      action={
        layout === 'row' &&
        onHoldAxis && (
          <ToolButton
            icon={isHeld(axis) ? mdiLock : mdiLockOpenVariantOutline}
            label={t(isHeld(axis) ? 'inspector.releaseAxis' : 'inspector.holdAxis', {
              axis: axis.toUpperCase(),
            })}
            description={t('inspector.holdAxisHint')}
            tooltip={TIP_LEFT}
            variant="header"
            active={isHeld(axis)}
            onClick={() => onHoldAxis(axis, !isHeld(axis))}
          />
        )
      }
      onGestureStart={beginGesture}
      onGestureEnd={onGestureEnd}
      {...bounds}
    />
  )

  return (
    <>
      <div className={FIELD_ROW} {...hint}>
        {/* The name and the fold are one target: a chevron of its own would be a second control
            for a row whose whole left column already says what it is. */}
        <PropertyLabel
          as="button"
          label={label}
          leading={<UiIcon path={stacked ? mdiChevronDown : mdiChevronRight} size={12} />}
          gesture={{
            type: 'button',
            'aria-expanded': stacked,
            onClick: () => setStacked(current => !current),
            ...HINT_LEFT(t(stacked ? 'inspector.stackFoldHint' : 'inspector.stackUnfoldHint')),
          }}
          className="cursor-pointer border-y-0 border-l-0 bg-transparent p-0 text-left"
        />

        {!stacked && (
          <div
            className="grid min-w-0 flex-1 gap-2"
            style={{ gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))` }}
          >
            {shown.map(axis => axisField(axis, 'inline'))}
          </div>
        )}

        {stacked && <div className="min-w-0 flex-1" />}

        <FieldActions>
          {lockable && (
            <ToolButton
              icon={locked ? mdiLink : mdiLinkOff}
              label={t(locked ? 'inspector.unlinkAxes' : 'inspector.linkAxes')}
              description={t('inspector.linkAxesHint')}
              // `TIP_*` and not `HINT_*`: the padlock draws no word of its own, so this is where
              // its accessible name comes from.
              tooltip={TIP_LEFT}
              variant="header"
              active={locked}
              onClick={lock}
            />
          )}

          <ResetButton onReset={resetAll} />
        </FieldActions>
      </div>

      {/* One line per axis, each in the shared label column — the same shape as every other
          property line, which is what makes a stacked vector readable beside them. */}
      {stacked && shown.map(axis => axisField(axis, 'row'))}
    </>
  )
}

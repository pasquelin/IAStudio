import { mdiChevronDown, mdiChevronRight, mdiLink, mdiLinkOff } from '@mdi/js'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { NumericBounds } from '@shared/numeric'
import { HINT_LEFT, TIP_LEFT } from '@/helpers/tooltip'
import { NumberField } from './NumberField'
import { PropertyLabel } from './PropertyLabel'
import { ResetButton } from './ResetButton'
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
    /** Puts the whole vector back where it started. Absent while it already stands there. */
    onReset?: () => void
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
  onReset,
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

  const move = (axis: keyof AxisValue, next: number): void => {
    const from = held.current
    // Nothing to scale FROM at zero: the axis moves alone rather than taking the others to zero
    // with it, which is the one case a ratio cannot express.
    if (!locked || !from || (from[axis] ?? 0) === 0) return onChange({ ...value, [axis]: next })

    const factor = next / (from[axis] ?? 1)
    const scaled = Object.fromEntries(shown.map(one => [one, (from[one] ?? 0) * factor]))
    onChange({ ...value, ...scaled })
  }

  const axisField = (axis: keyof AxisValue, layout: 'row' | 'inline') => (
    <NumberField
      key={axis}
      layout={layout}
      axis={axis}
      disabled={disabled}
      scId={scId && `${scId}.${axis}`}
      label={axis.toUpperCase()}
      value={value[axis] ?? 0}
      onChange={next => move(axis, next)}
      onGestureStart={onGestureStart}
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

        {/* Guarded here rather than inside, so a row standing at its default mounts nothing. */}
        {onReset && <ResetButton onReset={onReset} />}
      </div>

      {/* One line per axis, each in the shared label column — the same shape as every other
          property line, which is what makes a stacked vector readable beside them. */}
      {stacked && shown.map(axis => axisField(axis, 'row'))}
    </>
  )
}

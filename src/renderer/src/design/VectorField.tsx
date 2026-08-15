import type { NumericBounds } from '@shared/numeric'
import { NumberField } from './NumberField'
import { FIELD_LABEL, FIELD_ROW, type GestureProps } from './styles'

/** A position or a rotation, or the two components of a repeat. `z` absent means two axes. */
export type AxisValue = { x: number; y: number; z?: number }

export type VectorFieldProps<V extends AxisValue> = NumericBounds &
  GestureProps & {
    label: string
    value: V
    onChange: (value: V) => void
  }

const XYZ: readonly (keyof AxisValue)[] = ['x', 'y', 'z']

/**
 * The components of a position, a rotation, a scale or a repeat. Each axis is a `NumberField` of
 * its own, so each one drags on its own letter — and the axis names are not translated: X, Y and
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
  ...bounds
}: VectorFieldProps<V>) {
  // Read off the value rather than declared: a tiling has two components and a transform three,
  // and the shape of the value is the only place that fact already lives.
  const shown = XYZ.filter(axis => value[axis] !== undefined)

  return (
    <div className={FIELD_ROW}>
      <span title={label} className={FIELD_LABEL}>
        {label}
      </span>

      <div
        className="grid min-w-0 flex-1 gap-2"
        style={{ gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))` }}
      >
        {shown.map(axis => (
          <NumberField
            key={axis}
            layout="inline"
            label={axis.toUpperCase()}
            value={value[axis] ?? 0}
            onChange={next => onChange({ ...value, [axis]: next })}
            onGestureStart={onGestureStart}
            onGestureEnd={onGestureEnd}
            {...bounds}
          />
        ))}
      </div>
    </div>
  )
}

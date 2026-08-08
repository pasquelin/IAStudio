import type { NumericBounds } from '@/helpers/numeric'
import { NumberField } from './NumberField'
import { FIELD_LABEL, FIELD_ROW, type GestureProps } from './styles'

/** Any axis-keyed value: a 3D position, or the two components of a repeat. */
export type AxisValue = Record<string, number>

export type VectorFieldProps<V extends AxisValue> = NumericBounds &
  GestureProps & {
    label: string
    value: V
    /** Which axes to show, in the order they read. Three by default, as a transform has. */
    axes?: readonly (keyof V & string)[]
    onChange: (value: V) => void
  }

const XYZ: readonly string[] = ['x', 'y', 'z']

/**
 * The components of a position, a rotation, a scale or a repeat. Each axis is a `NumberField` of
 * its own, so each one drags on its own letter — and the axis names are not translated: X, Y and
 * Z are what every 3D application calls them, in every language.
 *
 * Generic over its axes rather than fixed at three: a tiling has two, and a second component
 * built for it would have been this one with a line removed.
 */
export function VectorField<V extends AxisValue>({
  label,
  value,
  axes,
  onChange,
  onGestureStart,
  onGestureEnd,
  ...bounds
}: VectorFieldProps<V>) {
  const shown = axes ?? XYZ.filter((axis): axis is keyof V & string => axis in value)

  return (
    <div className={FIELD_ROW}>
      <span className={FIELD_LABEL}>{label}</span>

      <div
        className="grid min-w-0 flex-1 gap-1"
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

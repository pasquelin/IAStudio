import type { Vector3 } from '@shared/domain/scene'
import type { NumericBounds } from '@/helpers/numeric'
import { NumberField } from './NumberField'

export type Vector3FieldProps = NumericBounds & {
  label: string
  value: Vector3
  onChange: (value: Vector3) => void
  onGestureStart?: () => void
  onGestureEnd?: () => void
}

const AXES: readonly (keyof Vector3)[] = ['x', 'y', 'z']

/**
 * The three components of a position, a rotation or a scale. Each axis is a `NumberField` of
 * its own, so each one drags on its own letter — and the axis names are not translated: X, Y
 * and Z are what every 3D application calls them, in every language.
 */
export function Vector3Field({
  label,
  value,
  onChange,
  onGestureStart,
  onGestureEnd,
  ...bounds
}: Vector3FieldProps) {
  return (
    <div className="flex min-w-0 items-center gap-1 text-[11px]">
      <span className="text-muted w-16 shrink-0 truncate">{label}</span>

      <div className="grid min-w-0 flex-1 grid-cols-3 gap-1">
        {AXES.map(axis => (
          <NumberField
            key={axis}
            layout="inline"
            label={axis.toUpperCase()}
            value={value[axis]}
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

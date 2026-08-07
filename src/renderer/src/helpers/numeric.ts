/** Bounds and step, shared by every numeric control of the studio. */
export function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value))
}

/**
 * Rounds to the nearest step. `toPrecision` on the way out because binary floats leave a tail:
 * without it a roughness dragged past 0.3 reads 0.30000000000000004 in the field.
 */
export function snap(value: number, step: number): number {
  if (!(step > 0)) return value
  return Number((Math.round(value / step) * step).toPrecision(12))
}

export type NumericBounds = {
  min?: number
  max?: number
  step?: number
}

/** A value made acceptable: snapped to the step first, then held inside the bounds. */
export function bound(value: number, { min, max, step }: NumericBounds): number {
  const snapped = step === undefined ? value : snap(value, step)
  return clamp(snapped, min ?? -Infinity, max ?? Infinity)
}

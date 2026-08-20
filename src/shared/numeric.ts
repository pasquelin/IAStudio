/** Bounds and step, shared by every numeric control of the studio. */
export function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value))
}

/**
 * `clamp` where the floor wins: bounds that cross answer `low`, never a `high` below it. A span
 * narrower than its content produces exactly that — a surface wider than its window, a fade longer
 * than its clip — and `clamp` would answer the negative bound, putting the thing out of reach.
 */
export function clampAtLeast(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value))
}

/**
 * Rounds to the nearest step. `toPrecision` on the way out because binary floats leave a tail:
 * without it a roughness dragged past 0.3 reads 0.30000000000000004 in the field.
 */
export function snap(value: number, step: number): number {
  if (!(step > 0)) return value
  return Number((Math.round(value / step) * step).toPrecision(12))
}

/**
 * Where a value stands in its span, as a percentage. A span of nothing answers 0 rather than
 * `NaN`, which a rail would take as `width: NaN%` — an invalid declaration, dropped in silence.
 */
export function percentIn(value: number, min: number, max: number): number {
  return max > min ? ((value - min) / (max - min)) * 100 : 0
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

/**
 * Whether a value is already acceptable. The other half of `bound`, for the three doors that
 * REFUSE rather than clamp — a generation's parameters, an action's input, a field of a panel.
 *
 * The step is deliberately not checked: a slider offers one, and every value between two notches
 * is still a value the same control accepts once typed.
 */
export function withinBounds(value: number, { min, max }: NumericBounds): boolean {
  return (min === undefined || value >= min) && (max === undefined || value <= max)
}

export type VeilLift = { veil: number; through: boolean }

/**
 * The veil a scene that has just arrived still owes, on ITS clock — a swap restarts it at zero.
 *
 * 🛑 The DEEPER of the lift and `written`, the arrived timeline having already veiled this step.
 */
export function veilLift(elapsed: number, span: number, written: number): VeilLift {
  const left = 1 - elapsed / span
  return { veil: Math.max(left, written), through: left <= 0 }
}

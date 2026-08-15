/**
 * The one time unit the studio measures a timeline in.
 *
 * It lives in `shared/` rather than beside the montage because a scene's animation is written in
 * the same unit, and `shared/` is the only place both sides may read from.
 */

/** Timeline time, in microseconds. Never float seconds: drift accumulates over a long edit. */
export type Us = number

export const SECOND: Us = 1_000_000

/** For the few surfaces a person reads or types seconds on — an inspector field, a duration. */
export function usToSeconds(time: Us): number {
  return time / SECOND
}

/** Rounded, always: a fractional microsecond is not a time this studio can hold. */
export function secondsToUs(value: number): Us {
  return Math.round(value * SECOND)
}

/** How long one frame lasts. Rounded, so a whole number of them never drifts off the grid. */
export function frameDuration(fps: number): Us {
  return Math.round(SECOND / fps)
}

/** Snapped to the frame grid: a playhead between two frames shows a pose no render would. */
export function snapToFrame(time: Us, fps: number): Us {
  const frame = frameDuration(fps)
  return Math.max(0, Math.round(time / frame) * frame)
}

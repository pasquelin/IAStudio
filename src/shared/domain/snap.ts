/**
 * The four snaps, and the values each offers. One switch per snap rather than one for all four:
 * laying a prop on the floor while its angle stays free is the gesture the single boolean could
 * not spell.
 *
 * Here rather than beside the toolbar because three surfaces read the same lists — the bar, the
 * Environment panel and the preferences — and three copies had already started to differ.
 */
export type SnapKind = 'surface' | 'translate' | 'rotate' | 'scale'

/** Which snaps are on, for one document at one moment. How coarse they are is a preference. */
export type Snapping = Record<SnapKind, boolean>

/** Drawn in this order, left to right: what a drag lands ON, then the three it advances BY. */
export const SNAP_KINDS: readonly SnapKind[] = ['surface', 'translate', 'rotate', 'scale']

export const NOTHING_SNAPPED: Snapping = {
  surface: false,
  translate: false,
  rotate: false,
  scale: false,
}

export const EVERYTHING_SNAPPED: Snapping = {
  surface: true,
  translate: true,
  rotate: true,
  scale: true,
}

/** Whether any snap at all is on — what the toolbar's one magnet button lights on. */
export function isSnapping(snapping: Snapping): boolean {
  return SNAP_KINDS.some(kind => snapping[kind])
}

/**
 * What the master switch does: one press turns everything off, the next gives back exactly what
 * was on. Nothing to give back — the last state was empty — turns all four on.
 */
export function snappingToggled(snapping: Snapping, remembered: Snapping): Snapping {
  if (isSnapping(snapping)) return NOTHING_SNAPPED
  return isSnapping(remembered) ? remembered : EVERYTHING_SNAPPED
}

/**
 * Metres. Down to a millimetre, which `settingsRegistry` justifies its `min` with: these are what
 * the Environment panel offers too. Each list stays inside the bounds its setting declares —
 * `boundsOf('three.snapScale')` stops at 1, so the ratio of ten Unreal offers is not ours.
 *
 * EVERY list below holds a multiple of four, which is what lets the bar lay them out as one
 * family — `sceneSnapControls.test.ts` holds it against the width the window actually uses.
 */
export const SNAP_TRANSLATE_STEPS: readonly number[] = [0.001, 0.01, 0.1, 0.25, 0.5, 1, 5, 10]

/** Degrees. The angles a set is laid out on, from a nudge to a quarter turn. */
export const SNAP_ROTATE_STEPS: readonly number[] = [1, 5, 10, 15, 30, 45, 60, 90]

/**
 * Degrees, as 360 divided by a power of two. What spreading *n* objects round a circle needs,
 * and the reason the angle menu is the one menu with two families.
 */
export const SNAP_ROTATE_DIVISIONS: readonly number[] = [2.812, 5.625, 11.25, 22.5]

/** Ratios, largest first, as Unreal reads them. */
export const SNAP_SCALE_RATIOS: readonly number[] = [
  1, 0.5, 0.25, 0.125, 0.1, 0.0625, 0.03125, 0.015625,
]

/** Metres per second. Rungs inside `boundsOf('three.flySpeed')`, which the slider covers between. */
export const FLY_SPEEDS: readonly number[] = [0.5, 1, 2, 4, 8, 12, 16, 20]

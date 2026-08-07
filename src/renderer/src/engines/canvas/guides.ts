import type { CanvasState, Guide } from './canvas-state'

export type Axis = 'x' | 'y'

/** Screen pixels, so the pull feels the same at 25% and at 800%. */
export const SNAP_TOLERANCE = 6

/** How close to a guide already on the canvas the pointer must be to take it rather than draw. */
export const GUIDE_GRAB = 4

/**
 * What a dragged thing sticks to on one axis: the frame's edges, its middle, and every guide
 * laid on that axis. Document units.
 */
export function snapTargets(state: CanvasState, axis: Axis): number[] {
  const extent = axis === 'x' ? state.width : state.height
  const guides = state.guides.filter(guide => guide.axis === axis).map(guide => guide.position)
  return [0, extent / 2, extent, ...guides]
}

/**
 * The target within `tolerance`, or the value untouched. Nearest wins — two guides a pixel apart
 * would otherwise hand the drag to whichever was declared first.
 */
export function snapValue(value: number, targets: readonly number[], tolerance: number): number {
  let best: number | null = null
  let bestDistance = tolerance

  for (const target of targets) {
    const distance = Math.abs(target - value)
    if (distance <= bestDistance) {
      best = target
      bestDistance = distance
    }
  }
  return best ?? value
}

/** The guide under a pointer sitting at `position` on `axis`, nearest first. */
export function guideNear(
  guides: readonly Guide[],
  axis: Axis,
  position: number,
  tolerance: number,
): Guide | null {
  let best: Guide | null = null
  let bestDistance = tolerance

  for (const guide of guides) {
    if (guide.axis !== axis) continue
    const distance = Math.abs(guide.position - position)
    if (distance <= bestDistance) {
      best = guide
      bestDistance = distance
    }
  }
  return best
}

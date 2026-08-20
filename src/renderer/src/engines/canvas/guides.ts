import type { CanvasState, Guide } from './canvasState'

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
 * How far a moving box has to be nudged for one of its `edges` to land on a target. Zero when
 * none is close enough. A dragged layer has three candidate edges per axis — its two sides and
 * its middle — and the nearest pairing of any edge with any target wins.
 *
 * One edge is the single-value case, and there used to be a `snapValue` beside this for it:
 * `value + snapOffset([value], …)` is that function exactly, both branches included.
 */
export function snapOffset(
  edges: readonly number[],
  targets: readonly number[],
  tolerance: number,
): number {
  let best = 0
  let bestDistance = tolerance

  for (const edge of edges) {
    for (const target of targets) {
      const distance = Math.abs(target - edge)
      if (distance <= bestDistance) {
        best = target - edge
        bestDistance = distance
      }
    }
  }
  return best
}

/** The three places a box of `extent` starting at `start` wants to stick by. */
export function boxEdges(start: number, extent: number): number[] {
  return [start, start + extent / 2, start + extent]
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

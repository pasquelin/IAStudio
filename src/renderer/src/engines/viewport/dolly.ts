import type { Vector3 } from 'three'
import { clamp } from '@shared/numeric'

/**
 * `OrbitControls` multiplies its radius per notch: it closes on the target asymptotically and
 * never crosses it, so the step shrinks until motion dies out on the spot. Here the step keeps a
 * floor in metres, and the pivot is put back ahead once the camera has passed what it aimed at.
 */

/** Fraction of the distance to what is aimed at, spent per notch. */
export const DOLLY_RATE = 0.12

/** Metres. The smallest step a notch may take, and the whole reason approaching never stalls. */
export const DOLLY_FLOOR = 0.05

/**
 * Metres. Where the pivot rests once the camera has crossed what it aimed at — and where a
 * finished flight rests it too, `ViewportEngine` lending a borrowed camera its pivot at the same.
 */
export const PIVOT_AHEAD = 5

/**
 * Notches from a wheel event's `deltaY`. A mouse detent reports about 100 pixels, a trackpad
 * reports many small deltas — dividing by 100 serves both, and the cap keeps one violent flick
 * from throwing the camera across the scene.
 */
export function notchesOf(deltaY: number): number {
  return clamp(-deltaY / 100, -MAX_NOTCHES, MAX_NOTCHES)
}

const MAX_NOTCHES = 5

export type DollyRequest = {
  position: Vector3
  /** Where the camera looks, normalized. What the pivot is put back along after a crossing. */
  forward: Vector3
  /** Where the pointer points, normalized. What the camera actually travels along. */
  aim: Vector3
  /** What the pointer's ray met, or a point stood in for it when it met nothing. */
  aimed: Vector3
  /** Positive towards what is aimed at, negative away from it. Carries a flick's whole amount. */
  notches: number
}

export type DollyMove = {
  position: Vector3
  pivot: Vector3
  /** The aimed point is behind the camera now. Whoever aimed has to aim again — see `DOLLY_RATE`. */
  crossed: boolean
}

export function dollyTo({ position, forward, aim, aimed, notches }: DollyRequest): DollyMove {
  const step = Math.max(position.distanceTo(aimed) * DOLLY_RATE, DOLLY_FLOOR) * notches
  const moved = position.clone().addScaledVector(aim, step)

  // ON the line of sight, always: `OrbitControls` ends its frame on `lookAt(target)`, so a pivot
  // set off-axis would swing the view round to centre whatever the pointer was over. Its DEPTH is
  // the aimed point's own, measured from where the camera LANDS — a floor applied to a surface
  // merely NEARER than `PIVOT_AHEAD` would bury the pivot behind it.
  const depth = aimed.clone().sub(moved).dot(forward)
  const crossed = depth <= DOLLY_FLOOR

  return {
    position: moved,
    pivot: moved.clone().addScaledVector(forward, crossed ? PIVOT_AHEAD : depth),
    crossed,
  }
}

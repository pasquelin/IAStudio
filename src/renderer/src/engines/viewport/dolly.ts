import type { Vector3 } from 'three'
import { clamp } from '@shared/numeric'

/**
 * `OrbitControls` multiplies its radius per notch: it closes on the target asymptotically and
 * never crosses it, so the step shrinks until motion dies out on the spot. Here the step keeps a
 * floor in metres, and the pivot lands ON what the pointer met rather than on the line of sight.
 */

/** Fraction of the distance to what is aimed at, spent per notch. */
export const DOLLY_RATE = 0.12

/** Metres. The smallest step a notch may take, and the whole reason approaching never stalls. */
export const DOLLY_FLOOR = 0.05

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
  /** Where the pointer points, normalized. What the camera actually travels along. */
  aim: Vector3
  /** What the pointer's ray met, or a point stood in for it when it met nothing. */
  aimed: Vector3
  /** Positive towards what is aimed at, negative away from it. Carries a flick's whole amount. */
  notches: number
}

export type DollyMove = {
  position: Vector3
  /**
   * Where the view turns next — the world point the pointer met, wherever it sits on screen.
   * `null` once the camera has crossed it: it is behind now, and the caller keeps what it had.
   */
  pivot: Vector3 | null
  /** The aimed point is behind the camera now. Whoever aimed has to aim again — see `DOLLY_RATE`. */
  crossed: boolean
}

export function dollyTo({ position, aim, aimed, notches }: DollyRequest): DollyMove {
  const step = Math.max(position.distanceTo(aimed) * DOLLY_RATE, DOLLY_FLOOR) * notches
  const moved = position.clone().addScaledVector(aim, step)
  const crossed = aimed.clone().sub(moved).dot(aim) <= DOLLY_FLOOR

  return { position: moved, pivot: crossed ? null : aimed.clone(), crossed }
}

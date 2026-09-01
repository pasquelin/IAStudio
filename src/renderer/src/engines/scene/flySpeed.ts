import { boundsOf } from '@shared/domain/settingsRegistry'
import { clamp } from '@shared/numeric'

/** Geometric per notch: a slow speed refines by a hair, a fast one leaps. */
const PER_NOTCH = 1.15

// Read once: the registry answers by walking every descriptor, and this sits on the wheel.
const { min, max } = boundsOf('three.flySpeed')

/** What the setting allows, for a speed reaching the engine from anywhere but the wheel. */
export function clampFlySpeed(speed: number): number {
  return clamp(speed, min, max)
}

/** The wheel, spent on how fast one flies rather than on where one stands. */
export function speedAfterWheel(speed: number, notches: number): number {
  return clamp(speed * PER_NOTCH ** notches, min, max)
}

import type { CameraMotion, CameraShot, Easing } from '@shared/domain/animation'
import type { Us } from '@shared/domain/time'

/**
 * How far along its rail a camera stands at an instant — arithmetic alone, so it is held to
 * account without a scene.
 *
 * Deduced from the instant and NEVER accumulated frame by frame: that is what makes a scrub
 * repeatable, and it is the same discipline `poseAt` and `SceneAnimations.seek` are built on.
 */
export function progressAt(shot: CameraShot, motion: CameraMotion, time: Us): number {
  // A shot of no length covers no instant; answering its start is the only reading that cannot
  // divide by nothing.
  const ratio = shot.duration <= 0 ? 0 : (time - shot.start) / shot.duration
  const eased = ease(motion.easing, clampUnit(ratio))

  return motion.from + (motion.to - motion.from) * eased
}

/** Four curves, each a pure function of 0..1 — the absence of any of them shows at both ends. */
export function ease(easing: Easing, at: number): number {
  switch (easing) {
    case 'easeIn':
      return at * at
    case 'easeOut':
      return 1 - (1 - at) * (1 - at)
    case 'easeInOut':
      return at < 0.5 ? 2 * at * at : 1 - 2 * (1 - at) * (1 - at)
    case 'linear':
      return at
  }
}

/** Held inside the rail: a head dragged past the end of a shot must not run off its curve. */
export function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value))
}

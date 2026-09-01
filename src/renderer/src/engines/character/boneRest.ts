/**
 * What the skeleton window lets a joint's rest become — the two holds it offers, in one place.
 *
 * Both doors write the same rest: the gizmo on release, and the axis fields on a keystroke. A
 * hold spelled at each of them is a hold one of them walks through, which is a padlock that only
 * draws itself.
 *
 * Arithmetic and nothing else, so it can be held to account without a viewport.
 */
import type { Transform, Vector3 } from '@shared/domain/transform'

/** The three a joint can be held on. */
export type BoneAxis = 'x' | 'y' | 'z'

export type BoneHold = {
  /** The axes that must not move, whichever door asked. */
  heldAxes: readonly BoneAxis[]
  /** Whether the joint keeps its distance to its parent, so the bone turns rather than stretches. */
  lockedLengths: boolean
}

/**
 * `moved` brought back within what the holds allow, measured against where the joint `rested`.
 *
 * The axes come first and the leash second, and that order is the whole of it: a leash applied
 * before a held axis was put back would leave the joint off its sphere.
 */
export function restWithin(rested: Transform, moved: Transform, hold: BoneHold): Transform {
  const kept = (was: Vector3, next: Vector3): Vector3 => ({
    x: hold.heldAxes.includes('x') ? was.x : next.x,
    y: hold.heldAxes.includes('y') ? was.y : next.y,
    z: hold.heldAxes.includes('z') ? was.z : next.z,
  })

  return {
    position: onLeash(rested.position, kept(rested.position, moved.position), hold.lockedLengths),
    rotation: kept(rested.rotation, moved.rotation),
    scale: moved.scale,
  }
}

/**
 * A joint kept at the distance it rested at, so the bone TURNS rather than stretches.
 *
 * A rest position IS the offset to the parent, so the length of a bone is the length of this
 * vector and nothing else. A joint pulled onto its parent keeps where it was: there is no
 * direction to point a bone of zero length in.
 */
function onLeash(rested: Vector3, moved: Vector3, locked: boolean): Vector3 {
  if (!locked) return moved

  const length = Math.hypot(rested.x, rested.y, rested.z)
  const reach = Math.hypot(moved.x, moved.y, moved.z)
  if (length <= 0 || reach <= 0) return rested

  return {
    x: (moved.x / reach) * length,
    y: (moved.y / reach) * length,
    z: (moved.z / reach) * length,
  }
}

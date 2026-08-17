/**
 * Picking a bone, as screen arithmetic rather than as a ray.
 *
 * A bone carries no geometry — it is a transform, and what a skeleton draws are lines between
 * them. Raycasting those lines answers a SEGMENT, not a named bone, and the bones of a rig cross
 * every mesh they drive, so a ray through the viewport lands on whichever one happens to be
 * behind the pointer. That is why bones were kept off the raycaster entirely.
 *
 * Projecting each bone to the screen and taking the nearest one has neither problem: it names a
 * bone directly, it never picks one hidden behind a shoulder by accident, and it is pure — which
 * is what lets it be held to account without a GPU.
 */

/** A bone as the screen sees it: normalised device coordinates, both axes in `[-1, 1]`. */
export type ProjectedBone = {
  nodeId: string
  bone: string
  x: number
  y: number
  /** Depth in the same space. Anything outside `[-1, 1]` is behind the camera or past its far plane. */
  z: number
}

export type Pointer = { x: number; y: number }

/**
 * How near the pointer must fall, in normalised device units. Roughly forty pixels across a
 * thousand-pixel view — a rig's bones crowd, and asking for less is asking for a miss.
 */
export const BONE_REACH = 0.04

/**
 * The bone under the pointer, or nothing.
 *
 * Nearest wins, and depth breaks a tie: two bones projecting to the same spot are one in front of
 * the other, and the front one is the one being looked at.
 */
export function nearestBone(
  bones: readonly ProjectedBone[],
  pointer: Pointer,
  reach = BONE_REACH,
): ProjectedBone | null {
  let best: ProjectedBone | null = null
  let bestDistance = Infinity

  for (const bone of bones) {
    // Behind the camera, or past the far plane: it is not on screen at all.
    if (bone.z < -1 || bone.z > 1) continue

    const distance = Math.hypot(bone.x - pointer.x, bone.y - pointer.y)
    if (distance > reach) continue

    if (distance < bestDistance || (distance === bestDistance && best && bone.z < best.z)) {
      best = bone
      bestDistance = distance
    }
  }

  return best
}

/**
 * Whether a clip carries its character across the floor, and what to do when the band already does.
 *
 * Pure, like `rigState.ts`: everything here is the shape of a track list, so it is read without a
 * GPU and without a mixer.
 */
import { AnimationClip, PropertyBinding } from 'three'
import type { AnimationTimeline } from '@shared/domain/animation'
import type { RootMotion } from '@shared/domain/scene'
import type { SkeletonBone } from './rigState'

/**
 * The track that carries a clip's travel: the position channel of the bone nearest the top of
 * the rig that holds one.
 *
 * Nearest the top rather than the root itself, because the two are often not the same bone — a
 * Tripo rig holds a static `Root` above the `Hip` that actually moves, and reading only the root
 * would find a track that never changes and neutralise nothing.
 */
export function rootTrackOf(clip: AnimationClip, bones: readonly SkeletonBone[]): string | null {
  const depths = depthsOf(bones)
  let found: { name: string; depth: number } | null = null

  for (const track of clip.tracks) {
    const parsed = PropertyBinding.parseTrackName(track.name)
    if (parsed.propertyName !== 'position') continue

    const depth = depths.get(parsed.nodeName)
    if (depth === undefined || (found && depth >= found.depth)) continue

    found = { name: track.name, depth }
  }

  return found?.name ?? null
}

/** How far under the top of the rig each bone sits. Absent from the map is "not a bone of it". */
function depthsOf(bones: readonly SkeletonBone[]): Map<string, number> {
  const parents = new Map(bones.map(bone => [bone.name, bone.parent]))
  const depths = new Map<string, number>()

  for (const bone of bones) {
    let depth = 0
    let above = bone.parent
    // Bounded by the rig itself: `skeletonBonesOf` reads parents off a tree, so there is no cycle.
    while (above) {
      depth += 1
      above = parents.get(above) ?? null
    }
    depths.set(bone.name, depth)
  }

  return depths
}

/**
 * Whether the node itself is driven along the band, which is what `auto` yields to.
 *
 * Two keys at least: one key holds a constant offset rather than a trajectory. A muted track
 * still counts — muting a trajectory is meant to stop the node moving, not to hand the travel
 * back to the clip and have the character walk off on its own.
 */
export function nodeTravelsOnBand(timeline: AnimationTimeline, nodeId: string): boolean {
  return timeline.tracks.some(
    track =>
      track.target.nodeId === nodeId &&
      !track.target.bone &&
      track.target.property === 'position' &&
      track.keys.length > 1,
  )
}

/**
 * Whether a block's own travel is used.
 *
 * `auto` is what stops the double displacement, and it is the central case of the whole feature:
 * a walk cycle played along a trajectory from A to B must walk ON THE SPOT, or the character
 * covers the ground twice and arrives past B.
 */
export function travelsWith(motion: RootMotion, onBand: boolean): boolean {
  if (motion === 'inPlace') return false
  if (motion === 'travel') return true

  return !onBand
}

/**
 * The clip one block plays: a COPY of the file's, without its travel when the block stays in place.
 *
 * A copy in both cases, and for two reasons that meet here. The file's clip is shared by every
 * instance built from it, so stripping it in place would take the travel from every other node
 * playing it; and a mixer keys its actions by clip, so two blocks of the same clip need two
 * clips or they would share one head and one weight.
 */
export function blockClip(
  clip: AnimationClip,
  rootTrack: string | null,
  travel: boolean,
): AnimationClip {
  const kept =
    travel || !rootTrack ? clip.tracks : clip.tracks.filter(track => track.name !== rootTrack)

  return new AnimationClip(
    clip.name,
    clip.duration,
    kept.map(track => track.clone()),
  )
}

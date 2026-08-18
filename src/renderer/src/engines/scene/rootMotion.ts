/**
 * Whether a clip carries its character across the floor, and what to do when the band already does.
 * Pure, like `rigState.ts`: all of it is the shape of a track list, read without a GPU or a mixer.
 */
import { AnimationClip, PropertyBinding } from 'three'
import type { AnimationTimeline } from '@shared/domain/animation'
import type { RootMotion } from '@shared/domain/scene'
import type { SkeletonBone } from './rigState'

/**
 * The track that carries a clip's travel: the position channel of the bone NEAREST THE TOP of the
 * rig that holds one — never the root itself, since a Tripo rig holds a static `Root` above the
 * `Hip` that moves, and reading the root would neutralise a track that never changes.
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
    // Bounded rather than trusted: a rig read off a tree cannot loop, but one edited in a document
    // can, and a hung walk here would freeze the window rather than draw a wrong pose.
    while (above && depth <= bones.length) {
      depth += 1
      above = parents.get(above) ?? null
    }
    depths.set(bone.name, depth)
  }

  return depths
}

/**
 * Whether the node itself is driven along the band, which is what `auto` yields to. Two keys at
 * least — one holds an offset, not a trajectory. A MUTED track counts: muting a trajectory stops
 * the node, it does not hand the travel back to the clip and send the character off on its own.
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
 * Whether a block's own travel is used. `auto` is what stops the double displacement: a walk
 * played along a trajectory from A to B must walk ON THE SPOT, or the character covers the ground
 * twice and arrives past B.
 */
export function travelsWith(motion: RootMotion, onBand: boolean): boolean {
  if (motion === 'inPlace') return false
  if (motion === 'travel') return true

  return !onBand
}

/**
 * The clip one block plays: a COPY of the file's, without its travel when the block stays in
 * place. A copy in both cases — the file's clip is shared by every instance built from it, and a
 * mixer keys its actions by clip, so two blocks of one clip would share a head and a weight.
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

import { AnimationClip, QuaternionKeyframeTrack, VectorKeyframeTrack } from 'three'
import { describe, expect, it } from 'vitest'
import { SECOND } from '@shared/domain/time'
import { animationTrack, timelineWith } from './animation-fixtures'
import type { SkeletonBone } from './rigState'
import { blockClip, nodeTravelsOnBand, rootTrackOf, travelsWith } from './rootMotion'

/** A Tripo-shaped rig: a static `Root` above the `Hip` that actually carries the walk. */
const BONES: SkeletonBone[] = [
  { name: 'Root', parent: null },
  { name: 'Hip', parent: 'Root' },
  { name: 'Spine', parent: 'Hip' },
]

/** Hips that cross four units of floor while bouncing between 0.9 and 1.1 above it. */
function travellingWalk(): AnimationClip {
  return new AnimationClip('Walk', 1, [
    new VectorKeyframeTrack('Spine.position', [0, 1], [0, 0, 0, 0, 0.1, 0]),
    new VectorKeyframeTrack('Hip.position', [0, 1], [0, 0.9, 0, 4, 1.1, 0]),
    new QuaternionKeyframeTrack('Hip.quaternion', [0, 1], [0, 0, 0, 1, 0, 0, 0, 1]),
  ])
}

describe('the track a clip travels on', () => {
  it('is the position of the bone nearest the top of the rig that holds one', () => {
    expect(rootTrackOf(travellingWalk(), BONES)).toBe('Hip.position')
  })

  it('is nothing at all for a clip that only turns its bones', () => {
    const inPlace = new AnimationClip('Idle', 1, [
      new QuaternionKeyframeTrack('Hip.quaternion', [0, 1], [0, 0, 0, 1, 0, 0, 0, 1]),
    ])

    expect(rootTrackOf(inPlace, BONES)).toBeNull()
  })

  it('ignores a track addressing something that is not a bone of this rig', () => {
    const stray = new AnimationClip('Walk', 1, [
      new VectorKeyframeTrack('Camera.position', [0, 1], [0, 0, 0, 0, 0, 4]),
    ])

    expect(rootTrackOf(stray, BONES)).toBeNull()
  })
})

describe('whether the band already carries the node', () => {
  const key = (time: number, z: number) => ({ time, value: { x: 0, y: 0, z } })

  it('says so for a node with a trajectory of its own', () => {
    const timeline = timelineWith([
      animationTrack('walk-there', 'position', [key(0, 0), key(SECOND, 4)]),
    ])

    expect(nodeTravelsOnBand(timeline, 'cube')).toBe(true)
  })

  it('does not count a single key, which holds an offset rather than a trajectory', () => {
    const timeline = timelineWith([animationTrack('nudge', 'position', [key(0, 1)])])

    expect(nodeTravelsOnBand(timeline, 'cube')).toBe(false)
  })

  // Muting a trajectory stops the NODE. Handing the travel back to the clip would send the
  // character walking off on its own, which is the very thing `auto` exists to prevent.
  it('counts a muted track all the same, so muting never starts a character travelling', () => {
    const timeline = timelineWith([
      animationTrack('walk-there', 'position', [key(0, 0), key(SECOND, 4)], { muted: true }),
    ])

    expect(nodeTravelsOnBand(timeline, 'cube')).toBe(true)
  })

  it('does not count a track on a BONE of the node, which moves the node nowhere', () => {
    const timeline = timelineWith([
      animationTrack('hip', 'position', [key(0, 0), key(SECOND, 4)], {
        target: { nodeId: 'cube', bone: 'Hip', property: 'position' },
      }),
    ])

    expect(nodeTravelsOnBand(timeline, 'cube')).toBe(false)
  })
})

describe('whether a block uses its own travel', () => {
  // The three other arms are read where they can be SEEN, on `SceneAnimations`; only this one
  // has no counterpart there.
  it('never travels when it is asked to stay in place', () => {
    expect(travelsWith('inPlace', false)).toBe(false)
    expect(travelsWith('inPlace', true)).toBe(false)
  })
})

describe('the clip one block plays', () => {
  /** Rounded: a keyframe track holds float32, so 0.9 comes back as 0.8999999761581421. */
  const hips = (clip: AnimationClip): number[] =>
    [...(clip.tracks.find(track => track.name === 'Hip.position')?.values ?? [])].map(value =>
      Number(value.toFixed(4)),
    )

  it('holds the hips where they started, so the character stops crossing the floor', () => {
    expect(hips(blockClip(travellingWalk(), 'Hip.position', false))).toEqual([0, 0.9, 0, 0, 1.1, 0])
  })

  it('keeps the HEIGHT and its bounce, or the character sinks into the floor and slides', () => {
    // The bind pose is not the walk's own height: dropping the whole channel put the hips back
    // where the file bound them, and took the step out of the step.
    const heights = hips(blockClip(travellingWalk(), 'Hip.position', false)).filter(
      (_, index) => index % 3 === 1,
    )

    expect(heights).toEqual([0.9, 1.1])
  })

  it('keeps everything when the block travels', () => {
    expect(hips(blockClip(travellingWalk(), 'Hip.position', true))).toEqual([0, 0.9, 0, 4, 1.1, 0])
  })

  it('never touches the clip the file owns, which every other node plays too', () => {
    const source = travellingWalk()
    blockClip(source, 'Hip.position', false)

    expect(hips(source)).toEqual([0, 0.9, 0, 4, 1.1, 0])
  })

  it('is a clip of its own, so two blocks of one clip hold two heads', () => {
    const source = travellingWalk()

    expect(blockClip(source, null, true).uuid).not.toBe(source.uuid)
  })
})

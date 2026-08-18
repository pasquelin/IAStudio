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

function travellingWalk(): AnimationClip {
  return new AnimationClip('Walk', 1, [
    new VectorKeyframeTrack('Spine.position', [0, 1], [0, 0, 0, 0, 0.1, 0]),
    new VectorKeyframeTrack('Hip.position', [0, 1], [0, 0, 0, 0, 0, 4]),
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
  it('never does when it is asked to stay in place', () => {
    expect(travelsWith('inPlace', false)).toBe(false)
    expect(travelsWith('inPlace', true)).toBe(false)
  })

  it('always does when it is asked to travel, band or no band', () => {
    expect(travelsWith('travel', true)).toBe(true)
  })

  it('yields to a trajectory the band already holds, which is the double displacement', () => {
    expect(travelsWith('auto', true)).toBe(false)
    expect(travelsWith('auto', false)).toBe(true)
  })
})

describe('the clip one block plays', () => {
  it('keeps the turns when the travel is taken out, so a walk still walks', () => {
    const cut = blockClip(travellingWalk(), 'Hip.position', false)

    expect(cut.tracks.map(track => track.name)).toEqual(['Spine.position', 'Hip.quaternion'])
  })

  it('keeps everything when the block travels', () => {
    const kept = blockClip(travellingWalk(), 'Hip.position', true)

    expect(kept.tracks).toHaveLength(3)
  })

  it('never touches the clip the file owns, which every other node plays too', () => {
    const source = travellingWalk()
    blockClip(source, 'Hip.position', false)

    expect(source.tracks).toHaveLength(3)
  })

  it('is a clip of its own, so two blocks of one clip hold two heads', () => {
    const source = travellingWalk()

    expect(blockClip(source, null, true).uuid).not.toBe(source.uuid)
    expect(blockClip(source, null, true).uuid).not.toBe(blockClip(source, null, true).uuid)
  })
})

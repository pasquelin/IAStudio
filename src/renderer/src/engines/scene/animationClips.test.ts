import { Object3D } from 'three'
import { describe, expect, it } from 'vitest'
import { SECOND } from '@shared/domain/time'
import type { Transform } from '@shared/domain/scene'
import { animationTrack, timelineWith } from './animation-fixtures'
import { timelineClip } from './animationClips'

const REST: Transform = {
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
}

const target = (object: Object3D, rest: Transform = REST) => ({
  nodeId: 'cube',
  object,
  restOf: () => rest,
})

describe('the timeline as a clip a file can hold', () => {
  it('answers nothing when no track drives anything', () => {
    expect(timelineClip(timelineWith([]), [target(new Object3D())])).toBeNull()
  })

  /**
   * glTF holds absolute values per node; a track here holds a DELTA over the rest pose, and
   * several tracks add up. Baking is what the two have in common — §7 of the plan asks for the
   * resulting movement, not for the tool that produced it.
   */
  it('bakes the pose the object stands in, not the delta a track holds', () => {
    const object = new Object3D()
    const timeline = timelineWith([
      animationTrack('t', 'position', [
        { time: 0, value: { x: 0, y: 0, z: 0 } },
        { time: SECOND, value: { x: 10, y: 0, z: 0 } },
      ]),
    ])

    const clip = timelineClip(timeline, [
      target(object, { ...REST, position: { x: 5, y: 0, z: 0 } }),
    ])
    const track = clip?.tracks.find(one => one.name.endsWith('.position'))

    // 5 at rest, plus the 0 and 10 the track adds.
    expect([...(track?.values ?? [])].slice(0, 3)).toEqual([5, 0, 0])
    expect([...(track?.values ?? [])].slice(3, 6)).toEqual([15, 0, 0])
  })

  it('counts in seconds, which is what a clip is measured in', () => {
    const timeline = timelineWith(
      [
        animationTrack('t', 'position', [
          { time: 0, value: { x: 0, y: 0, z: 0 } },
          { time: 2 * SECOND, value: { x: 1, y: 0, z: 0 } },
        ]),
      ],
      { duration: 4 * SECOND },
    )

    const clip = timelineClip(timeline, [target(new Object3D())])

    expect(clip?.duration).toBe(4)
    expect([...(clip?.tracks[0]?.times ?? [])]).toEqual([0, 2])
  })

  it('turns a turn into a quaternion, which is the only rotation a file carries', () => {
    const timeline = timelineWith([
      animationTrack('t', 'rotation', [
        { time: 0, value: { x: 0, y: 0, z: 0 } },
        { time: SECOND, value: { x: 0, y: Math.PI / 2, z: 0 } },
      ]),
    ])

    const clip = timelineClip(timeline, [target(new Object3D())])

    expect(clip?.tracks.map(one => one.name.split('.')[1])).toEqual(['quaternion'])
    expect(clip?.tracks[0]?.values).toHaveLength(8)
  })

  /** A file full of tracks that hold one repeated value is noise every reader has to skip. */
  it('writes no track for a property nothing moves', () => {
    const timeline = timelineWith([
      animationTrack('t', 'position', [
        { time: 0, value: { x: 0, y: 0, z: 0 } },
        { time: SECOND, value: { x: 1, y: 0, z: 0 } },
      ]),
    ])

    const names = timelineClip(timeline, [target(new Object3D())])?.tracks.map(one => one.name)

    expect(names?.some(name => name.endsWith('.scale'))).toBe(false)
    expect(names?.some(name => name.endsWith('.quaternion'))).toBe(false)
  })

  /** The track has to name the object the FILE holds, which is the copy the exporter walks. */
  it('names the object it drives, so the clip binds to it', () => {
    const object = new Object3D()
    const timeline = timelineWith([
      animationTrack('t', 'position', [
        { time: 0, value: { x: 0, y: 0, z: 0 } },
        { time: SECOND, value: { x: 1, y: 0, z: 0 } },
      ]),
    ])

    expect(timelineClip(timeline, [target(object)])?.tracks[0]?.name).toBe(
      `${object.uuid}.position`,
    )
  })

  it('drives a bone by the object that wears its name', () => {
    const model = new Object3D()
    const bone = new Object3D()
    bone.name = 'Spine'
    model.add(bone)

    const timeline = timelineWith([
      animationTrack(
        't',
        'position',
        [
          { time: 0, value: { x: 0, y: 0, z: 0 } },
          { time: SECOND, value: { x: 3, y: 0, z: 0 } },
        ],
        { target: { nodeId: 'cube', bone: 'Spine', property: 'position' } },
      ),
    ])

    expect(timelineClip(timeline, [target(model)])?.tracks[0]?.name).toBe(`${bone.uuid}.position`)
  })

  /**
   * A bone rests where the FILE put it; the document holds a reference to a model, never its
   * skeleton. Baking a bone against the NODE's rest would displace the whole rig by wherever the
   * node happens to stand.
   */
  it('measures a bone against its own rest, not the node it hangs from', () => {
    const model = new Object3D()
    const bone = new Object3D()
    bone.name = 'Spine'
    model.add(bone)

    const timeline = timelineWith([
      animationTrack(
        't',
        'position',
        [
          { time: 0, value: { x: 0, y: 0, z: 0 } },
          { time: SECOND, value: { x: 1, y: 0, z: 0 } },
        ],
        { target: { nodeId: 'cube', bone: 'Spine', property: 'position' } },
      ),
    ])

    const clip = timelineClip(timeline, [
      {
        nodeId: 'cube',
        object: model,
        restOf: bone =>
          bone
            ? { ...REST, position: { x: 100, y: 0, z: 0 } }
            : { ...REST, position: { x: 7, y: 0, z: 0 } },
      },
    ])

    // 100 — the bone's own rest — never 7, which is where the node stands.
    expect([...(clip?.tracks[0]?.values ?? [])].slice(0, 3)).toEqual([100, 0, 0])
  })

  /** A rig replaced under a timeline still naming its old joints must not fail the export. */
  it('drops a channel whose bone the model no longer has', () => {
    const timeline = timelineWith([
      animationTrack(
        't',
        'position',
        [
          { time: 0, value: { x: 0, y: 0, z: 0 } },
          { time: SECOND, value: { x: 1, y: 0, z: 0 } },
        ],
        { target: { nodeId: 'cube', bone: 'Gone', property: 'position' } },
      ),
    ])

    expect(timelineClip(timeline, [target(new Object3D())])).toBeNull()
  })

  /** A muted track is one the viewport does not play, so it is not one the file should hold. */
  it('leaves out what the timeline itself does not play', () => {
    const timeline = timelineWith([
      animationTrack(
        't',
        'position',
        [
          { time: 0, value: { x: 0, y: 0, z: 0 } },
          { time: SECOND, value: { x: 1, y: 0, z: 0 } },
        ],
        { muted: true },
      ),
    ])

    expect(timelineClip(timeline, [target(new Object3D())])).toBeNull()
  })
})

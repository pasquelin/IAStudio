import { Euler, Quaternion } from 'three'
import { describe, expect, it } from 'vitest'
import type { AnimationTimeline, AnimationTrack } from '@shared/domain/animation'
import { ONE, ZERO } from '@shared/domain/animation'
import { SECOND } from '@shared/domain/time'
import { animationTrack, timelineWith } from './animation-fixtures'
import { IDENTITY_TRANSFORM } from './scene-state'
import {
  clampPlayhead,
  deltaOf,
  contributionAt,
  drivenNodes,
  playsThrough,
  poseAt,
  valueAt,
  withKey,
  withoutKey,
} from './animation-eval'

const vec = (x: number, y = 0, z = 0) => ({ x, y, z })

const track = animationTrack
const timelineOf = (tracks: AnimationTrack[]): AnimationTimeline => timelineWith(tracks)

describe('where a track stands', () => {
  it('answers its neutral while it holds no key at all', () => {
    expect(valueAt(track('t', 'position', []), 1)).toEqual(ZERO)
    expect(valueAt(track('t', 'scale', []), 1)).toEqual(ONE)
  })

  it('runs straight between two keys', () => {
    const moving = track('t', 'position', [
      { time: 0, value: vec(0) },
      { time: 2, value: vec(10) },
    ])

    expect(valueAt(moving, 1).x).toBeCloseTo(5, 5)
  })

  it('holds flat outside its keys rather than easing out of nothing', () => {
    const moving = track('t', 'position', [
      { time: 1, value: vec(4) },
      { time: 2, value: vec(8) },
    ])

    expect(valueAt(moving, 0).x).toBe(4)
    expect(valueAt(moving, 9).x).toBe(8)
  })

  it('takes the later of two keys landing on the same instant', () => {
    const moving = track('t', 'position', [
      { time: 1, value: vec(4) },
      { time: 1, value: vec(9) },
    ])

    expect(valueAt(moving, 1).x).toBe(4)
  })
})

describe('what the tracks add up to', () => {
  it('answers nothing at all where no track drives the object', () => {
    expect(contributionAt(timelineOf([]), 'cube', 0)).toBeNull()
  })

  it('adds two moves together, which is the whole point of stacking them', () => {
    const timeline = timelineOf([
      track('a', 'position', [{ time: 0, value: vec(2) }]),
      track('b', 'position', [{ time: 0, value: vec(5) }]),
    ])

    expect(contributionAt(timeline, 'cube', 0)?.position.x).toBe(7)
  })

  it('MULTIPLIES two scales, since the neutral of a scale is one', () => {
    const timeline = timelineOf([
      track('a', 'scale', [{ time: 0, value: { x: 2, y: 2, z: 2 } }]),
      track('b', 'scale', [{ time: 0, value: { x: 2, y: 2, z: 2 } }]),
    ])

    expect(contributionAt(timeline, 'cube', 0)?.scale.x).toBe(4)
  })

  /**
   * The trap the whole file exists for. Two quarter turns on different axes, added component by
   * component, describe a rotation neither of them meant — the composed one is what a viewport
   * shows, and it is not the sum.
   */
  it('COMPOSES two turns on different axes rather than adding their angles', () => {
    const quarter = Math.PI / 2
    const timeline = timelineOf([
      track('a', 'rotation', [{ time: 0, value: { x: quarter, y: 0, z: 0 } }]),
      track('b', 'rotation', [{ time: 0, value: { x: 0, y: quarter, z: 0 } }]),
    ])

    const turned = contributionAt(timeline, 'cube', 0)?.rotation
    if (!turned) throw new Error('two tracks drive it')

    const expected = new Quaternion()
      .setFromEuler(new Euler(quarter, 0, 0))
      .multiply(new Quaternion().setFromEuler(new Euler(0, quarter, 0)))
    const got = new Quaternion().setFromEuler(new Euler(turned.x, turned.y, turned.z))

    expect(Math.abs(got.dot(expected))).toBeCloseTo(1, 6)
    // And the naive sum would have put a quarter turn on each of two axes.
    expect([turned.x, turned.y, turned.z]).not.toEqual([quarter, quarter, 0])
  })

  it('leaves a muted track out of the sum', () => {
    const timeline = timelineOf([
      track('a', 'position', [{ time: 0, value: vec(2) }]),
      track('b', 'position', [{ time: 0, value: vec(5) }], { muted: true }),
    ])

    expect(contributionAt(timeline, 'cube', 0)?.position.x).toBe(2)
  })

  it('hears only the soloed tracks once anything is soloed', () => {
    const timeline = timelineOf([
      track('a', 'position', [{ time: 0, value: vec(2) }]),
      track('b', 'position', [{ time: 0, value: vec(5) }], { solo: true }),
    ])

    expect(contributionAt(timeline, 'cube', 0)?.position.x).toBe(5)
  })

  it("keeps one object out of another object's tracks", () => {
    const timeline = timelineOf([
      track('a', 'position', [{ time: 0, value: vec(2) }], {
        target: { nodeId: 'sphere', property: 'position' },
      }),
    ])

    expect(contributionAt(timeline, 'cube', 0)).toBeNull()
  })

  it('keeps a bone apart from the node that carries it', () => {
    const timeline = timelineOf([
      track('a', 'position', [{ time: 0, value: vec(3) }], {
        target: { nodeId: 'perso', bone: 'spine', property: 'position' },
      }),
    ])

    expect(contributionAt(timeline, 'perso', 0)).toBeNull()
    expect(contributionAt(timeline, 'perso', 0, 'spine')?.position.x).toBe(3)
  })
})

describe('the pose an object stands in', () => {
  it('is its own where nothing drives it', () => {
    expect(poseAt(IDENTITY_TRANSFORM, timelineOf([]), 'cube', 0)).toBe(IDENTITY_TRANSFORM)
  })

  it('adds the delta to the rest pose rather than replacing it', () => {
    const rest = { ...IDENTITY_TRANSFORM, position: vec(10) }
    const timeline = timelineOf([track('a', 'position', [{ time: 0, value: vec(5) }])])

    expect(poseAt(rest, timeline, 'cube', 0).position.x).toBe(15)
  })

  it('multiplies the rest scale rather than adding to it', () => {
    const rest = { ...IDENTITY_TRANSFORM, scale: { x: 3, y: 3, z: 3 } }
    const timeline = timelineOf([track('a', 'scale', [{ time: 0, value: { x: 2, y: 2, z: 2 } }])])

    expect(poseAt(rest, timeline, 'cube', 0).scale.x).toBe(6)
  })
})

describe('the small rules around the head', () => {
  it('keeps the head inside the timeline', () => {
    expect(clampPlayhead(-2 * SECOND, 5 * SECOND)).toBe(0)
    expect(clampPlayhead(9 * SECOND, 5 * SECOND)).toBe(5 * SECOND)
  })

  it('names every object the timeline drives, and nothing else', () => {
    const timeline = timelineOf([
      track('a', 'position', []),
      track('b', 'position', [], { target: { nodeId: 'sphere', property: 'position' } }),
    ])

    expect([...drivenNodes(timeline)].sort()).toEqual(['cube', 'sphere'])
  })

  it('says whether a track is heard', () => {
    const one = track('a', 'position', [])
    expect(playsThrough(one, false)).toBe(true)
    expect(playsThrough({ ...one, muted: true }, false)).toBe(false)
    // Once anything is soloed, a track that is not soloed goes quiet.
    expect(playsThrough(one, true)).toBe(false)
    expect(playsThrough({ ...one, solo: true }, true)).toBe(true)
  })
})

describe('writing keys', () => {
  it('keeps them sorted, and replaces one landing on the same instant', () => {
    const keys = withKey(withKey([], { time: 2, value: vec(1) }), { time: 1, value: vec(3) })
    expect(keys.map(key => key.time)).toEqual([1, 2])

    const rewritten = withKey(keys, { time: 1, value: vec(9) })
    expect(rewritten).toHaveLength(2)
    expect(rewritten[0]?.value.x).toBe(9)
  })

  it('takes one back out by its instant', () => {
    const keys = withKey(withKey([], { time: 1, value: vec(1) }), { time: 2, value: vec(2) })
    expect(withoutKey(keys, 1).map(key => key.time)).toEqual([2])
  })
})

describe('the difference a drag has to be written as', () => {
  const rest = {
    position: { x: 1, y: 2, z: 3 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 2, y: 4, z: 5 },
  }

  it('subtracts a move', () => {
    const pose = { ...rest, position: { x: 4, y: 2, z: 3 } }
    expect(deltaOf(rest, pose, 'position')).toEqual({ x: 3, y: 0, z: 0 })
  })

  it('divides a scale, since scales multiply', () => {
    const pose = { ...rest, scale: { x: 6, y: 4, z: 10 } }
    expect(deltaOf(rest, pose, 'scale')).toEqual({ x: 3, y: 1, z: 2 })
  })

  it('answers one for an axis resting at zero rather than dividing by it', () => {
    const flat = { ...rest, scale: { x: 0, y: 0, z: 0 } }
    expect(deltaOf(flat, rest, 'scale')).toEqual({ x: 1, y: 1, z: 1 })
  })

  it('takes the turn back out rather than subtracting angles', () => {
    const quarter = Math.PI / 2
    const turned = { ...rest, rotation: { x: quarter, y: 0, z: 0 } }
    const delta = deltaOf(rest, turned, 'rotation')

    // Applied back onto the rest pose, it lands exactly where the drag put it.
    expect(delta.x).toBeCloseTo(quarter, 6)
  })

  it('round-trips: a delta laid back over the rest gives the pose it came from', () => {
    const quarter = Math.PI / 3
    const pose = {
      position: { x: 5, y: 5, z: 5 },
      rotation: { x: quarter, y: 0, z: 0 },
      scale: { x: 4, y: 8, z: 10 },
    }
    const timeline = timelineOf([
      track('p', 'position', [{ time: 0, value: deltaOf(rest, pose, 'position') }]),
      track('r', 'rotation', [{ time: 0, value: deltaOf(rest, pose, 'rotation') }]),
      track('s', 'scale', [{ time: 0, value: deltaOf(rest, pose, 'scale') }]),
    ])

    const back = poseAt(rest, timeline, 'cube', 0)
    expect(back.position).toEqual(pose.position)
    expect(back.scale).toEqual(pose.scale)
    expect(back.rotation.x).toBeCloseTo(quarter, 6)
  })
})

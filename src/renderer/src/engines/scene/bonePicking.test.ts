import { describe, expect, it } from 'vitest'
import { BONE_REACH, nearestBone, type ProjectedBone } from './bonePicking'

const bone = (name: string, x: number, y: number, z = 0): ProjectedBone => ({
  nodeId: 'rig',
  bone: name,
  x,
  y,
  z,
})

describe('picking a bone off the screen', () => {
  it('answers the one under the pointer', () => {
    const bones = [bone('Hips', 0, 0), bone('Head', 0.5, 0.5)]
    expect(nearestBone(bones, { x: 0.5, y: 0.5 })?.bone).toBe('Head')
  })

  it('answers the NEAREST when several are within reach', () => {
    const bones = [bone('Hips', 0, 0), bone('Spine', 0.01, 0)]
    expect(nearestBone(bones, { x: 0.011, y: 0 })?.bone).toBe('Spine')
  })

  it('answers nothing when the pointer is clear of every bone', () => {
    expect(nearestBone([bone('Hips', 0, 0)], { x: 0.9, y: 0.9 })).toBeNull()
  })

  it('answers nothing at all when the rig has no bone', () => {
    expect(nearestBone([], { x: 0, y: 0 })).toBeNull()
  })

  it('takes the one in FRONT when two project to the same spot', () => {
    const behind = bone('Behind', 0, 0, 0.9)
    const front = bone('Front', 0, 0, -0.9)
    expect(nearestBone([behind, front], { x: 0, y: 0 })?.bone).toBe('Front')
    // And the order they arrive in must not decide it.
    expect(nearestBone([front, behind], { x: 0, y: 0 })?.bone).toBe('Front')
  })

  it('ignores a bone behind the camera, however near it projects', () => {
    expect(nearestBone([bone('Hips', 0, 0, -1.5)], { x: 0, y: 0 })).toBeNull()
  })

  it('ignores a bone past the far plane', () => {
    expect(nearestBone([bone('Hips', 0, 0, 1.5)], { x: 0, y: 0 })).toBeNull()
  })

  it('honours the reach it is given, so a caller may tighten it', () => {
    const bones = [bone('Hips', 0, 0)]
    expect(nearestBone(bones, { x: BONE_REACH / 2, y: 0 })).not.toBeNull()
    expect(nearestBone(bones, { x: BONE_REACH / 2, y: 0 }, 0.001)).toBeNull()
  })

  it('accepts a bone exactly on the edge of the reach', () => {
    expect(nearestBone([bone('Hips', 0, 0)], { x: BONE_REACH, y: 0 })).not.toBeNull()
  })
})

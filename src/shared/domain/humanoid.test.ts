import { describe, expect, it } from 'vitest'
import {
  HUMANOID_BODY_ROLES,
  HUMANOID_FINGERS,
  HUMANOID_FINGER_JOINTS,
  HUMANOID_FINGER_ROLES,
  HUMANOID_ROLES,
  HUMANOID_SIDES,
  isHumanoidRole,
  type HumanoidBodyRole,
  type HumanoidFinger,
  type HumanoidFingerJoint,
  type HumanoidSide,
} from './humanoid'

/**
 * The three axes and the body are listed by hand, so each needs the record that ties it to its
 * union — a member added without being listed would simply never be walked, and the gap reads as
 * coverage. The thirty finger roles need none: they are the product of the three axes.
 */
describe('the lists that stand for a humanoid union', () => {
  it('names every side', () => {
    const all: Record<HumanoidSide, true> = { Left: true, Right: true }

    expect([...HUMANOID_SIDES].sort()).toEqual(Object.keys(all).sort())
  })

  it('names every finger', () => {
    const all: Record<HumanoidFinger, true> = {
      Thumb: true,
      Index: true,
      Middle: true,
      Ring: true,
      Little: true,
    }

    expect([...HUMANOID_FINGERS].sort()).toEqual(Object.keys(all).sort())
  })

  it('names every finger joint', () => {
    const all: Record<HumanoidFingerJoint, true> = { 1: true, 2: true, 3: true }

    expect([...HUMANOID_FINGER_JOINTS].sort()).toEqual(Object.keys(all).map(Number).sort())
  })

  it('names every role of the body', () => {
    const all: Record<HumanoidBodyRole, true> = {
      Hips: true,
      Spine: true,
      Chest: true,
      UpperChest: true,
      Neck: true,
      Head: true,
      LeftShoulder: true,
      LeftUpperArm: true,
      LeftLowerArm: true,
      LeftHand: true,
      RightShoulder: true,
      RightUpperArm: true,
      RightLowerArm: true,
      RightHand: true,
      LeftUpperLeg: true,
      LeftLowerLeg: true,
      LeftFoot: true,
      LeftToes: true,
      RightUpperLeg: true,
      RightLowerLeg: true,
      RightFoot: true,
      RightToes: true,
    }

    expect([...HUMANOID_BODY_ROLES].sort()).toEqual(Object.keys(all).sort())
  })
})

describe('the humanoid standard', () => {
  it('covers every hand joint of both hands', () => {
    expect(HUMANOID_FINGER_ROLES).toHaveLength(30)
    expect(HUMANOID_FINGER_ROLES).toContain('LeftThumb1')
    expect(HUMANOID_FINGER_ROLES).toContain('RightLittle3')
  })

  it('is the fifty-two of mixamo, body first', () => {
    expect(HUMANOID_ROLES).toHaveLength(52)
    expect(HUMANOID_ROLES[0]).toBe('Hips')
  })

  it('holds no name twice', () => {
    expect(new Set(HUMANOID_ROLES).size).toBe(HUMANOID_ROLES.length)
  })

  it('recognises a role, and refuses a bone that merely looks like one', () => {
    expect(isHumanoidRole('LeftHand')).toBe(true)
    expect(isHumanoidRole('mixamorig:LeftHand')).toBe(false)
    expect(isHumanoidRole('L_ThighTwist01')).toBe(false)
    expect(isHumanoidRole(null)).toBe(false)
  })
})

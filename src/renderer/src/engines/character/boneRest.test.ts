import { describe, expect, it } from 'vitest'
import { IDENTITY_TRANSFORM } from '@shared/domain/transform'
import { restWithin } from './boneRest'

/** A bone resting three units along X, so its length is three and easy to read back. */
const RESTED = { ...IDENTITY_TRANSFORM, position: { x: 3, y: 0, z: 0 } }

const FREE = { heldAxes: [], lockedLengths: false }

const at = (x: number, y: number, z: number) => ({
  ...IDENTITY_TRANSFORM,
  position: { x, y, z },
})

const lengthOf = (transform: { position: { x: number; y: number; z: number } }): number =>
  Math.hypot(transform.position.x, transform.position.y, transform.position.z)

describe('what a joint may be moved to', () => {
  it('writes what was asked where nothing is held', () => {
    expect(restWithin(RESTED, at(1, 2, 3), FREE).position).toEqual({ x: 1, y: 2, z: 3 })
  })

  // 🛑 The one the window was refused over: a hand asking for a hundred pixels stretched the bone
  // to the floor. A rest position IS the offset to the parent, so its length is the bone's.
  it('keeps the bone its own length, so it turns rather than stretches', () => {
    const held = restWithin(RESTED, at(0, 10, 0), { ...FREE, lockedLengths: true })

    expect(lengthOf(held)).toBeCloseTo(3, 6)
    expect(held.position.y).toBeCloseTo(3, 6)
    expect(held.position.x).toBeCloseTo(0, 6)
  })

  it('leaves a joint pulled onto its parent where it rested, having no direction to point in', () => {
    const held = restWithin(RESTED, at(0, 0, 0), { ...FREE, lockedLengths: true })

    expect(held.position).toEqual(RESTED.position)
  })

  it('puts a held axis back, whichever door asked', () => {
    const held = restWithin(RESTED, at(1, 2, 3), { ...FREE, heldAxes: ['y'] })

    expect(held.position).toEqual({ x: 1, y: 0, z: 3 })
  })

  // The axes first and the leash second: a leash taken before a held axis is put back would
  // leave the joint off its own sphere.
  it('holds an axis AND the length together, which is a joint on a circle', () => {
    const held = restWithin(RESTED, at(0, 5, 5), { heldAxes: ['x'], lockedLengths: true })

    expect(lengthOf(held)).toBeCloseTo(3, 6)
    expect(held.position.x).toBeCloseTo((3 / Math.hypot(3, 5, 5)) * 3, 6)
  })

  it('never touches the rotation of a free axis, nor the scale', () => {
    const turned = { ...at(1, 0, 0), rotation: { x: 0.5, y: 0, z: 0 } }

    expect(restWithin(RESTED, turned, FREE).rotation.x).toBeCloseTo(0.5, 6)
    expect(restWithin(RESTED, turned, FREE).scale).toEqual(turned.scale)
  })
})

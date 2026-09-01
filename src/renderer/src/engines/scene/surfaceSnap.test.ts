import { describe, expect, it } from 'vitest'
import { Box3, Object3D, Quaternion, Vector3 } from 'three'
import { heldBy, surfaceLift, surfaceRayFrom, surfaceTurn } from './surfaceSnap'

describe('surfaceRayFrom', () => {
  // Started at the box's own bottom, a ray meets the floor the object is already resting on and
  // the drop reads as zero for ever after — the snap would stick to the first surface it touched.
  it('starts above the box, over its centre', () => {
    const from = surfaceRayFrom(
      new Box3(new Vector3(-1, 2, -1), new Vector3(3, 6, 1)),
      new Vector3(),
    )

    expect(from.x).toBe(1)
    expect(from.z).toBe(0)
    expect(from.y).toBeGreaterThan(6)
  })
})

describe('surfaceLift', () => {
  it('drops what floats and raises what is buried', () => {
    expect(surfaceLift(5, 0, 0)).toBe(-5)
    expect(surfaceLift(-2, 0, 0)).toBe(2)
  })

  it('leaves the offset between the two, so two faces stop fighting over one plane', () => {
    expect(surfaceLift(5, 0, 0.02)).toBeCloseTo(-4.98)
  })
})

describe('surfaceTurn', () => {
  it('leaves a level surface alone', () => {
    const turned = surfaceTurn(new Vector3(0, 1, 0), new Quaternion(), new Quaternion())

    expect(turned.angleTo(new Quaternion())).toBeCloseTo(0)
  })

  it('lays the up of what is dragged along the slope it meets', () => {
    const slope = new Vector3(1, 1, 0).normalize()
    const turned = surfaceTurn(slope, new Quaternion(), new Quaternion())

    expect(new Vector3(0, 1, 0).applyQuaternion(turned).angleTo(slope)).toBeCloseTo(0)
  })

  // The pivot wears the anchor's whole orientation in the local frame, tilt included. Measured
  // off the world's up, the turn then sent the object's up to `held · normal` — and « align to
  // surface » did nothing at all on a flat floor.
  it('lays a TILTED object along the slope too', () => {
    const tilted = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 5)
    const slope = new Vector3(0.3, 1, 0).normalize()
    const turned = surfaceTurn(slope, tilted, new Quaternion())

    expect(new Vector3(0, 1, 0).applyQuaternion(turned).angleTo(slope)).toBeCloseTo(0)
  })

  // A prop dropped on a ramp keeps the heading it was given: the turn is composed, not written over.
  it('keeps the heading the object already wore', () => {
    const heading = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2)
    const turned = surfaceTurn(new Vector3(0, 1, 0), heading, new Quaternion())

    expect(turned.angleTo(heading)).toBeCloseTo(0)
  })
})

describe('heldBy', () => {
  // Left in, the drag meets its own underside on the first frame, reads a drop of zero and stops
  // moving for the rest of the gesture — with nothing to say why.
  it('knows the very thing being dragged, and what stands beside it', () => {
    const held = new Object3D()
    const floor = new Object3D()

    expect(heldBy(held, held)).toBe(true)
    expect(heldBy(floor, held)).toBe(false)
  })

  // Node objects nest, so a dragged group's own children are two levels down — reading the parent
  // alone left a group landing on top of its own child.
  it('reaches a child of a child, not the first parent alone', () => {
    const held = new Object3D()
    const group = new Object3D()
    const grandchild = new Object3D()
    held.add(group)
    group.add(grandchild)

    expect(heldBy(grandchild, held)).toBe(true)
  })
})

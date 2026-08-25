import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import { DOLLY_FLOOR, DOLLY_RATE, PIVOT_AHEAD, dollyTo, notchesOf } from './dolly'

const FORWARD = new Vector3(0, 0, -1)

/** Straight ahead: the aim and the gaze agree, which is the wheel over the middle of the view. */
function ahead(from: Vector3, aimed: Vector3, notches: number) {
  return dollyTo({ position: from, forward: FORWARD, aim: FORWARD, aimed, notches })
}

describe('dollying towards what the pointer aims at', () => {
  it('moves further when what is aimed at is further away', () => {
    const near = ahead(new Vector3(), new Vector3(0, 0, -10), 1)
    const far = ahead(new Vector3(), new Vector3(0, 0, -100), 1)
    expect(far.position.z).toBeLessThan(near.position.z)
  })

  it('keeps a floor in metres, so approaching never dies out one shrinking step at a time', () => {
    let position = new Vector3()
    // A target a millimetre ahead: proportional alone would step by a micrometre and stall.
    for (let i = 0; i < 20; i++) {
      position = ahead(position, new Vector3(0, 0, position.z - 0.001), 1).position
    }
    expect(position.z).toBeLessThanOrEqual(-20 * DOLLY_FLOOR)
  })

  it('crosses what it aims at instead of stopping short of it', () => {
    const target = new Vector3(0, 0, -0.02)
    const moved = ahead(new Vector3(), target, 1)
    expect(moved.position.z).toBeLessThan(target.z)
  })

  it('rests the pivot ahead of the camera once it has crossed', () => {
    const moved = ahead(new Vector3(), new Vector3(0, 0, -0.02), 1)
    expect(moved.pivot.z).toBeCloseTo(moved.position.z - PIVOT_AHEAD, 6)
  })

  it('puts the pivot at the depth of what was aimed at while that is still ahead', () => {
    const moved = ahead(new Vector3(), new Vector3(0, 0, -100), 1)
    expect(moved.pivot.z).toBeCloseTo(-100, 6)
  })

  /**
   * `OrbitControls` ends its frame on `lookAt(target)`. A pivot placed on an off-axis point would
   * therefore swing the whole view round to centre it — travelling, not turning, is the promise.
   */
  it('keeps the pivot on the line of sight, so travelling never turns the view', () => {
    const moved = dollyTo({
      position: new Vector3(),
      forward: FORWARD,
      aim: new Vector3(1, 0, -1).normalize(),
      aimed: new Vector3(30, 0, -30),
      notches: 1,
    })

    expect(moved.pivot.x).toBeCloseTo(moved.position.x, 6)
    expect(moved.pivot.y).toBeCloseTo(moved.position.y, 6)
  })

  it('travels towards the pointer rather than towards the middle of the view', () => {
    const aim = new Vector3(1, 0, -1).normalize()
    const moved = dollyTo({
      position: new Vector3(),
      forward: FORWARD,
      aim,
      aimed: new Vector3(0, 0, -10),
      notches: 1,
    })
    expect(moved.position.x).toBeGreaterThan(0)
  })

  it('backs away along the same line the wheel came in on', () => {
    const moved = ahead(new Vector3(), new Vector3(0, 0, -10), -1)
    expect(moved.position.z).toBeGreaterThan(0)
  })

  it('backs away faster the further out it already is, so a wide scene is left quickly', () => {
    const near = ahead(new Vector3(), new Vector3(0, 0, -10), -1).position.z
    const far = ahead(new Vector3(), new Vector3(0, 0, -1000), -1).position.z
    expect(far).toBeGreaterThan(near)
  })

  it('spends a trackpad flick in one go rather than a cran at a time', () => {
    const once = ahead(new Vector3(), new Vector3(0, 0, -10), 1).position.z
    const thrice = ahead(new Vector3(), new Vector3(0, 0, -10), 3).position.z
    expect(thrice).toBeCloseTo(once * 3, 6)
  })

  it('takes the rate from the distance, which is what makes one wheel serve every scale', () => {
    const moved = ahead(new Vector3(), new Vector3(0, 0, -10), 1)
    expect(moved.position.z).toBeCloseTo(-10 * DOLLY_RATE, 6)
  })
})

describe('reading the wheel', () => {
  it('takes a detent forward as one notch towards what is aimed at', () => {
    expect(notchesOf(-100)).toBe(1)
  })

  it('reads a detent backwards as pulling away', () => {
    expect(notchesOf(100)).toBe(-1)
  })

  it('answers a trackpad in fractions rather than rounding its many small deltas to nothing', () => {
    expect(notchesOf(-8)).toBeCloseTo(0.08, 6)
  })

  it('caps one violent flick, which would otherwise cross the whole scene at once', () => {
    expect(notchesOf(-100000)).toBe(notchesOf(-1000))
  })
})

import { describe, expect, it } from 'vitest'
import { EASINGS, type CameraMotion } from '@shared/domain/animation'
import { SECOND } from '@shared/domain/time'
import { cameraShot } from './animation-fixtures'
import { curveOf } from './cameraPath'
import { clampUnit, ease, progressAt } from './cameraMotion'

const shot = cameraShot('s1', { start: 2 * SECOND, duration: 4 * SECOND })
const whole: CameraMotion = { pathId: 'rail', easing: 'linear', from: 0, to: 1 }

describe('progressAt', () => {
  it('reads the whole rail across the whole shot', () => {
    expect(progressAt(shot, whole, 2 * SECOND)).toBe(0)
    expect(progressAt(shot, whole, 4 * SECOND)).toBe(0.5)
    expect(progressAt(shot, whole, 6 * SECOND)).toBe(1)
  })

  // A head dragged past a shot must not run the camera off the end of its rail.
  it('holds the camera on the rail on either side of the shot', () => {
    expect(progressAt(shot, whole, 0)).toBe(0)
    expect(progressAt(shot, whole, 30 * SECOND)).toBe(1)
  })

  it('takes only the stretch of rail the shot asked for', () => {
    const half: CameraMotion = { ...whole, from: 0.25, to: 0.75 }
    expect(progressAt(shot, half, 4 * SECOND)).toBeCloseTo(0.5, 6)
    expect(progressAt(shot, half, 2 * SECOND)).toBeCloseTo(0.25, 6)
  })

  // `from` past `to` is how a rail is run backwards, so neither is clamped against the other.
  it('runs the rail backwards when it starts past where it ends', () => {
    const back: CameraMotion = { ...whole, from: 1, to: 0 }
    expect(progressAt(shot, back, 2 * SECOND)).toBe(1)
    expect(progressAt(shot, back, 6 * SECOND)).toBe(0)
  })

  it('answers the start of a shot with no length rather than dividing by nothing', () => {
    const empty = cameraShot('s2', { start: 0, duration: 0 })
    expect(progressAt(empty, whole, 5 * SECOND)).toBe(0)
  })
})

describe('the speed curves', () => {
  it('leaves both ends where they are, whichever curve is asked for', () => {
    for (const easing of EASINGS) {
      expect(ease(easing, 0)).toBeCloseTo(0, 6)
      expect(ease(easing, 1)).toBeCloseTo(1, 6)
    }
  })

  it('opens slowly on an ease in, and closes slowly on an ease out', () => {
    expect(ease('easeIn', 0.5)).toBeLessThan(0.5)
    expect(ease('easeOut', 0.5)).toBeGreaterThan(0.5)
    expect(ease('easeInOut', 0.5)).toBeCloseTo(0.5, 6)
    expect(ease('linear', 0.3)).toBe(0.3)
  })

  it('holds a value inside the rail', () => {
    expect(clampUnit(-2)).toBe(0)
    expect(clampUnit(7)).toBe(1)
    expect(clampUnit(0.4)).toBe(0.4)
  })
})

/**
 * The claim the issue asked to check rather than assume: `getPoint` is parameterised per
 * segment, so a camera on a rail of very unequal segments speeds up through the short ones.
 * `getPointAt` reads the arc-length table instead, which is what makes a travelling watchable.
 */
describe('a rail of very unequal segments', () => {
  const curve = curveOf({
    kind: 'catmullrom',
    points: [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 100, y: 0, z: 0 },
    ],
    closed: false,
    tension: 0,
  })

  it('has the camera halfway along its LENGTH at half of the shot', () => {
    const half = curve.getPointAt(0.5)
    const whole = curve.getLength()

    expect(half.x).toBeGreaterThan(whole * 0.4)
    expect(half.x).toBeLessThan(whole * 0.6)
  })

  it('is what `getPoint` gets wrong, which is why nothing here calls it', () => {
    expect(curve.getPoint(0.5).x).toBeLessThan(curve.getPointAt(0.5).x / 2)
  })
})

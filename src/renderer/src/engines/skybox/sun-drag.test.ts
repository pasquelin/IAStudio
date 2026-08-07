import { describe, expect, it } from 'vitest'
import { directionFromAngles, type SphericalAngles } from '@shared/domain/angles'
import { gestureFor, SUN_GRAB_ANGLE } from './sun-drag'

const SUN: SphericalAngles = { elevation: Math.PI / 6, azimuth: 1 }

describe('which gesture a drag is', () => {
  it('grabs the sun when the ray looks straight at it', () => {
    expect(gestureFor(directionFromAngles(SUN), SUN)).toBe('sun')
  })

  it('turns the head when the ray looks the other way', () => {
    const opposite = directionFromAngles({ elevation: -SUN.elevation, azimuth: SUN.azimuth + 3 })
    expect(gestureFor(opposite, SUN)).toBe('look')
  })

  it('still grabs just inside the tolerance', () => {
    const near = directionFromAngles({ ...SUN, azimuth: SUN.azimuth + SUN_GRAB_ANGLE * 0.9 })
    expect(gestureFor(near, SUN)).toBe('sun')
  })

  it('lets go just outside it', () => {
    const far = directionFromAngles({ ...SUN, azimuth: SUN.azimuth + SUN_GRAB_ANGLE * 1.5 })
    expect(gestureFor(far, SUN)).toBe('look')
  })

  it('takes a tolerance, so a denser display can shrink the target', () => {
    const near = directionFromAngles({ ...SUN, azimuth: SUN.azimuth + 0.2 })
    expect(gestureFor(near, SUN, 0.3)).toBe('sun')
    expect(gestureFor(near, SUN, 0.1)).toBe('look')
  })

  it('measures the true angle, not the difference of the two angle pairs', () => {
    // Near a pole a large azimuth gap is a small angle on the sphere. Comparing azimuths
    // instead of directions would refuse a grab the user is looking right at.
    const pole: SphericalAngles = { elevation: 1.5, azimuth: 0 }
    const alsoNearPole = directionFromAngles({ elevation: 1.5, azimuth: Math.PI })
    expect(gestureFor(alsoNearPole, pole)).toBe('sun')
  })
})

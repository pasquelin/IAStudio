import { describe, expect, it } from 'vitest'
import {
  anglesFromDirection,
  clampElevation,
  directionFromAngles,
  normalizeAzimuth,
  POLE_LIMIT,
  type SphericalAngles,
} from './angles'

const FALLBACK: SphericalAngles = { elevation: 0.5, azimuth: 1.5 }

describe('azimuth wrapping', () => {
  it('leaves an angle already in range alone', () => {
    expect(normalizeAzimuth(0)).toBe(0)
    expect(normalizeAzimuth(Math.PI)).toBeCloseTo(Math.PI, 12)
  })

  it('brings a negative angle back into range', () => {
    expect(normalizeAzimuth(-Math.PI / 2)).toBeCloseTo((3 * Math.PI) / 2, 12)
  })

  it('folds a full turn onto itself', () => {
    expect(normalizeAzimuth(Math.PI * 2)).toBeCloseTo(0, 12)
    expect(normalizeAzimuth(Math.PI * 2.5)).toBeCloseTo(Math.PI / 2, 12)
  })
})

describe('elevation clamping', () => {
  it('stops just short of the pole, where the azimuth would stop meaning anything', () => {
    expect(clampElevation(Math.PI)).toBe(POLE_LIMIT)
    expect(clampElevation(-Math.PI)).toBe(-POLE_LIMIT)
    expect(POLE_LIMIT).toBeLessThan(Math.PI / 2)
  })

  it('leaves an angle inside the range untouched', () => {
    expect(clampElevation(0.3)).toBe(0.3)
  })
})

describe('direction from angles', () => {
  it('points at the zenith when the elevation is a quarter turn', () => {
    const { x, y, z } = directionFromAngles({ elevation: Math.PI / 2, azimuth: 0 })
    expect(y).toBeCloseTo(1, 12)
    expect(x).toBeCloseTo(0, 12)
    expect(z).toBeCloseTo(0, 12)
  })

  it('aims at +Z at azimuth zero, and at +X a quarter turn later', () => {
    expect(directionFromAngles({ elevation: 0, azimuth: 0 }).z).toBeCloseTo(1, 12)
    expect(directionFromAngles({ elevation: 0, azimuth: Math.PI / 2 }).x).toBeCloseTo(1, 12)
  })

  it('always returns a unit vector', () => {
    for (const elevation of [-Math.PI / 2, -0.4, 0, 0.9, Math.PI / 2]) {
      for (const azimuth of [0, 1.2, Math.PI, 5.7]) {
        const { x, y, z } = directionFromAngles({ elevation, azimuth })
        expect(Math.hypot(x, y, z)).toBeCloseTo(1, 12)
      }
    }
  })
})

describe('angles from direction', () => {
  it('inverts directionFromAngles for every angle a drag can produce', () => {
    for (const elevation of [-1.4, -0.5, 0, 0.5, 1.4]) {
      for (const azimuth of [0, 1.2, Math.PI, 4.9]) {
        const angles = anglesFromDirection(directionFromAngles({ elevation, azimuth }), FALLBACK)
        expect(angles.elevation).toBeCloseTo(elevation, 12)
        expect(angles.azimuth).toBeCloseTo(azimuth, 12)
      }
    }
  })

  it('reports an azimuth in [0, 2PI) even when the ray came back negative', () => {
    expect(anglesFromDirection({ x: -1, y: 0, z: 0 }, FALLBACK).azimuth).toBeCloseTo(
      (3 * Math.PI) / 2,
      12,
    )
  })

  it('normalizes a ray that is not unit length', () => {
    expect(anglesFromDirection({ x: 0, y: 5, z: 0 }, FALLBACK).elevation).toBeCloseTo(
      Math.PI / 2,
      12,
    )
  })

  it('never returns NaN when rounding pushes the ray past unit length', () => {
    const angles = anglesFromDirection({ x: 0, y: 1.0000001, z: 0 }, FALLBACK)
    expect(Number.isNaN(angles.elevation)).toBe(false)
    expect(angles.elevation).toBeCloseTo(Math.PI / 2, 6)
  })

  it('falls back for a ray of no length, where no angle is truer than another', () => {
    expect(anglesFromDirection({ x: 0, y: 0, z: 0 }, FALLBACK)).toEqual(FALLBACK)
  })
})

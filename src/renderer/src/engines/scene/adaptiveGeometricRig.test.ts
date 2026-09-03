import { describe, expect, it } from 'vitest'
import { worldPlaces } from '../character/rigWorld'
import { rigFit } from './rigFit'
import type { MeshSample } from './rigSnap'
import { adaptiveGeometricRig } from './adaptiveGeometricRig'

type SamplePoint = { x: number; y: number; z: number }

function ring(
  points: SamplePoint[],
  from: SamplePoint,
  to: SamplePoint,
  radiusAt: (fraction: number) => number,
): void {
  for (let step = 0; step <= 48; step += 1) {
    const fraction = step / 48
    const centre = {
      x: from.x + (to.x - from.x) * fraction,
      y: from.y + (to.y - from.y) * fraction,
      z: from.z + (to.z - from.z) * fraction,
    }
    for (let turn = 0; turn < 16; turn += 1) {
      const angle = (turn / 16) * Math.PI * 2
      const radius = radiusAt(fraction)
      const horizontal = Math.abs(to.x - from.x) > Math.abs(to.y - from.y)
      points.push(
        horizontal
          ? {
              x: centre.x,
              y: centre.y + Math.cos(angle) * radius,
              z: centre.z + Math.sin(angle) * radius,
            }
          : {
              x: centre.x + Math.cos(angle) * radius,
              y: centre.y,
              z: centre.z + Math.sin(angle) * radius,
            },
      )
    }
  }
}

function ellipsoid(points: SamplePoint[], centre: SamplePoint, radii: SamplePoint): void {
  for (let latitude = 1; latitude < 24; latitude += 1) {
    const phi = (latitude / 24) * Math.PI
    for (let longitude = 0; longitude < 32; longitude += 1) {
      const theta = (longitude / 32) * Math.PI * 2
      points.push({
        x: centre.x + Math.sin(phi) * Math.cos(theta) * radii.x,
        y: centre.y + Math.cos(phi) * radii.y,
        z: centre.z + Math.sin(phi) * Math.sin(theta) * radii.z,
      })
    }
  }
}

function stylizedCharacter(accessories = false): MeshSample {
  const points: SamplePoint[] = []
  const limbRadius = (fraction: number) => 0.09 - Math.sin(fraction * Math.PI) * 0.025
  ring(points, { x: -0.14, y: 0.08, z: 0 }, { x: -0.14, y: 0.68, z: 0 }, limbRadius)
  ring(points, { x: 0.14, y: 0.08, z: 0 }, { x: 0.14, y: 0.68, z: 0 }, limbRadius)
  ellipsoid(points, { x: 0, y: 0.92, z: 0 }, { x: 0.3, y: 0.3, z: 0.2 })
  ring(points, { x: 0, y: 1.16, z: 0 }, { x: 0, y: 1.3, z: 0 }, () => 0.095)
  ellipsoid(points, { x: 0, y: 1.55, z: 0 }, { x: 0.34, y: 0.34, z: 0.28 })
  ring(points, { x: 0.22, y: 1.14, z: 0 }, { x: 0.82, y: 1.14, z: 0 }, limbRadius)
  ring(points, { x: -0.22, y: 1.14, z: 0 }, { x: -0.82, y: 1.14, z: 0 }, limbRadius)

  if (accessories) {
    for (let index = 0; index < 20; index += 1) {
      points.push({ x: 0.5 + index * 0.015, y: 1.25, z: 0.1 })
      points.push({ x: 0, y: 1.9 + index * 0.02, z: -0.1 })
    }
  }

  const values = new Float32Array(points.flatMap(point => [point.x, point.y, point.z]))
  return {
    points: values,
    bounds: {
      min: {
        x: Math.min(...points.map(point => point.x)),
        y: Math.min(...points.map(point => point.y)),
        z: Math.min(...points.map(point => point.z)),
      },
      max: {
        x: Math.max(...points.map(point => point.x)),
        y: Math.max(...points.map(point => point.y)),
        z: Math.max(...points.map(point => point.z)),
      },
    },
  }
}

describe('adaptive geometric humanoid fitting', () => {
  it('finds the enlarged head and short legs from their sections instead of adult ratios', () => {
    const sample = stylizedCharacter()
    const adaptive = adaptiveGeometricRig(sample)
    const places = worldPlaces(adaptive.rig.bones)
    const legacy = worldPlaces(rigFit(sample.bounds).bones)

    expect(places.get('Head')?.y).toBeGreaterThan(1.45)
    expect(places.get('LeftLowerLeg')?.y).toBeLessThan(0.5)
    expect(places.get('Head')?.y).toBeLessThan(legacy.get('Head')?.y ?? 0)
    expect(adaptive.validation.issues).toEqual([])
  })

  it('uses robust sections so sparse hair and one shoulder ornament do not move the skeleton', () => {
    const plain = adaptiveGeometricRig(stylizedCharacter())
    const dressed = adaptiveGeometricRig(stylizedCharacter(true))
    const plainPlaces = worldPlaces(plain.rig.bones)
    const dressedPlaces = worldPlaces(dressed.rig.bones)

    expect(dressedPlaces.get('Head')?.y).toBeCloseTo(plainPlaces.get('Head')?.y ?? 0, 1)
    expect(dressedPlaces.get('LeftUpperArm')?.x).toBeCloseTo(
      plainPlaces.get('LeftUpperArm')?.x ?? 0,
      1,
    )
  })

  it('reports explainable landmarks, confidence, validation and phase timings', () => {
    let time = 0
    const result = adaptiveGeometricRig(stylizedCharacter(), () => {
      time += 1
      return time
    })

    expect(result.debug.landmarks.size).toBe(22)
    expect(result.debug.sections.length).toBe(72)
    expect(result.confidence.global).toBeGreaterThan(0)
    expect(result.timings).toEqual({
      preprocessing: 1,
      orientation: 1,
      symmetry: 1,
      spatialAnalysis: 1,
      landmarks: 1,
      optimization: 1,
      validation: 1,
      total: 7,
    })
  })
})

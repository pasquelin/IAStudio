import { InstancedMesh, LOD, Scene } from 'three'
import { describe, expect, it } from 'vitest'
import { DEFAULT_WORLD, scatterLayer } from '@shared/domain/scene'
import { createScatterSurface } from './scatterSurface'

describe('createScatterSurface', () => {
  it('draws a scatter layer as instanced batches, not one object per pose', () => {
    const scene = new Scene()
    const surface = createScatterSurface(scene)
    surface.sync({
      ...DEFAULT_WORLD,
      layers: [
        scatterLayer({
          id: 'trees',
          assets: [{ assetId: 'pine', weight: 1 }],
          origin: { x: 0, z: 0 },
          size: { x: 10, z: 10 },
          rules: {
            density: 0.5,
            spacing: 2,
            minScale: 1,
            maxScale: 1,
            randomRotation: false,
            randomTilt: 0,
            slopeAlign: 0,
            altitudeMin: -10,
            altitudeMax: 10,
            slopeMin: 0,
            slopeMax: 90,
          },
        }),
      ],
    })
    const lods = surface.object.children.filter(child => child instanceof LOD)
    const meshes = lods.flatMap(lod =>
      lod.levels.flatMap(level => (level.object instanceof InstancedMesh ? [level.object] : [])),
    )
    expect(lods.length).toBeGreaterThan(0)
    expect(meshes.length).toBe(lods.length)
    expect(meshes.reduce((sum, mesh) => sum + mesh.count, 0)).toBeGreaterThan(1)
    expect(surface.object.children.length).toBe(lods.length)
    surface.dispose()
  })
})

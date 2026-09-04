import { BoxGeometry, InstancedMesh, LOD, Mesh, MeshBasicMaterial, Object3D, Scene } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_WORLD, scatterLayer } from '@shared/domain/scene'
import { createScatterSurface } from './scatterSurface'
import { createModelCache } from './modelCache'

function staticTree(): Object3D {
  const root = new Object3D()
  const trunk = new Mesh(new BoxGeometry(0.4, 2, 0.4), new MeshBasicMaterial())
  const crown = new Mesh(new BoxGeometry(1.5, 1.5, 1.5), new MeshBasicMaterial())
  crown.position.y = 1.5
  root.add(trunk, crown)
  return root
}

describe('createScatterSurface', () => {
  it('draws every primitive of the loaded static asset as instanced batches', async () => {
    const scene = new Scene()
    const surface = createScatterSurface(scene, {
      models: createModelCache(
        async () => staticTree(),
        () => undefined,
      ),
      onUnsupported: () => undefined,
    })
    await surface.sync({
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
    expect(new Set(meshes.map(mesh => mesh.geometry)).size).toBe(2)
    expect(meshes.reduce((sum, mesh) => sum + mesh.count, 0)).toBeGreaterThan(1)
    expect(surface.object.children.length).toBe(lods.length)
    surface.dispose()
  })

  it('reports and excludes an animated asset instead of drawing a placeholder', async () => {
    const scene = new Scene()
    const animated = staticTree()
    animated.animations = [{ name: 'wind' }] as never
    const onUnsupported = vi.fn()
    const surface = createScatterSurface(scene, {
      models: createModelCache(
        async () => animated,
        () => undefined,
      ),
      onUnsupported,
    })
    await surface.sync({
      ...DEFAULT_WORLD,
      layers: [scatterLayer({ id: 'trees', assets: [{ assetId: 'pine', weight: 1 }] })],
    })
    expect(onUnsupported).toHaveBeenCalledWith('pine', 'animatedModel')
    expect(surface.object.children).toEqual([])
    surface.dispose()
  })
})

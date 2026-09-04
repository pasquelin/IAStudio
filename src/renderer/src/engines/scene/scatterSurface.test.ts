import { BoxGeometry, InstancedMesh, LOD, Mesh, MeshBasicMaterial, Object3D, Scene } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_WORLD, reliefLayer, scatterLayer, terrainEditLayer } from '@shared/domain/scene'
import { withChunkDelta } from '@shared/domain/relief'
import { createScatterSurface } from './scatterSurface'
import { createModelCache } from './modelCache'
import { cellKey } from './worldPartition'

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
    expect(meshes.length).toBe(lods.length * 2)
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

  it('rebuilds only cells covered by a dirtied relief chunk', async () => {
    const samples = { width: 129, height: 129, values: new Float32Array(129 * 129) }
    const scatter = scatterLayer({
      id: 'trees',
      assets: [{ assetId: 'pine', weight: 1 }],
      origin: { x: 0, z: 0 },
      size: { x: 512, z: 256 },
      rules: { ...scatterLayer({ id: 'rules' }).rules, density: 0.01, spacing: 16 },
    })
    const terrain = reliefLayer(
      { assetId: 'height' },
      {
        id: 'ground',
        origin: { x: 0, z: 0 },
        size: { x: 512, z: 512 },
        grain: 64,
        edits: [terrainEditLayer({ id: 'sculpt' })],
      },
    )
    const surface = createScatterSurface(new Scene(), {
      models: createModelCache(
        async () => staticTree(),
        () => undefined,
      ),
      onUnsupported: () => undefined,
    })
    const before = { ...DEFAULT_WORLD, layers: [terrain, scatter] }
    await surface.sync(before, new Map([['height', samples]]))
    const west = surface.objectsInCell('trees', cellKey(0, 0))
    const east = surface.objectsInCell('trees', cellKey(1, 0))
    const sculpt = withChunkDelta(samples, undefined, {
      column: 0,
      row: 0,
      localX: 1,
      localZ: 1,
      delta: 1,
    })
    await surface.sync(
      {
        ...before,
        layers: [{ ...terrain, edits: [terrainEditLayer({ id: 'sculpt', sculpt })] }, scatter],
      },
      new Map([['height', samples]]),
    )
    expect(surface.objectsInCell('trees', cellKey(0, 0))).not.toEqual(west)
    expect(surface.objectsInCell('trees', cellKey(1, 0))).toEqual(east)
    expect(surface.objectsInCell('trees', cellKey(1, 0))[0]).toBe(east[0])
    surface.dispose()
  })
})

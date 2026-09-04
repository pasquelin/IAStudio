import { MeshStandardMaterial, Texture } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { emptyGroundPaint } from '@shared/domain/groundPaint'
import { reliefLayer } from '@shared/domain/scene'
import {
  applyGroundPaint,
  syncGroundMaterial,
  type ReliefGroundMaterial,
} from './reliefGroundMaterial'

describe('relief ground material', () => {
  it('loads the persisted ground picture onto the terrain material', async () => {
    const texture = new Texture()
    const terrain: ReliefGroundMaterial = {
      material: new MeshStandardMaterial(),
      groundAssetId: null,
      groundGeneration: 0,
    }
    const layer = reliefLayer(
      { assetId: 'height' },
      {
        id: 'terrain',
        groundMaterials: [{ albedo: { assetId: 'ground' }, normal: null, channel: 'r' }],
      },
    )

    syncGroundMaterial(terrain, layer, { loadGround: async () => texture })

    await vi.waitFor(() => expect(terrain.material.map).toBe(texture))
  })

  it('keeps the legacy material on the unpatched standard path', async () => {
    const texture = new Texture()
    const terrain: ReliefGroundMaterial = {
      material: new MeshStandardMaterial(),
      groundAssetId: null,
      groundGeneration: 0,
    }
    const legacyProgramKey = terrain.material.customProgramCacheKey()
    const layer = reliefLayer(
      { assetId: 'height' },
      {
        id: 'terrain',
        groundMaterials: [{ albedo: { assetId: 'ground' }, normal: null, channel: 'r' }],
      },
    )

    syncGroundMaterial(terrain, layer, { loadGround: async () => texture })
    await vi.waitFor(() => expect(terrain.material.map).toBe(texture))

    expect(terrain.material.customProgramCacheKey()).toBe(legacyProgramKey)
    expect(terrain.groundUniforms).toBeUndefined()
  })

  it('binds the first albedo unchanged when splat weights appear', async () => {
    const textures = Array.from({ length: 4 }, () => new Texture())
    let loaded = 0
    const terrain: ReliefGroundMaterial = {
      material: new MeshStandardMaterial(),
      groundAssetId: null,
      groundGeneration: 0,
    }
    const layer = reliefLayer(
      { assetId: 'height' },
      {
        id: 'terrain',
        groundMaterials: [
          { albedo: { assetId: 'legacy' }, normal: null, channel: 'r' },
          { albedo: { assetId: 'grass' }, normal: { assetId: 'grass-normal' }, channel: 'g' },
        ],
        groundWeights: { assetId: 'weights' },
      },
    )

    syncGroundMaterial(terrain, layer, {
      loadGround: async () => textures[loaded++] ?? new Texture(),
    })
    await vi.waitFor(() => expect(terrain.groundUniforms).toBeDefined())

    expect(terrain.groundUniforms?.albedos[0]?.value).toBe(textures[0])
    expect(terrain.material.map).toBeNull()
    applyGroundPaint(terrain, emptyGroundPaint(2, 2))
    expect(terrain.groundUniforms?.weights.value).not.toBe(textures[3])
  })
})

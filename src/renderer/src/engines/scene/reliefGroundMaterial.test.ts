import { MeshStandardMaterial, Texture } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { emptyGroundPaint } from '@shared/domain/groundPaint'
import { reliefLayer } from '@shared/domain/scene'
import {
  applyGroundPaint,
  disposeGroundMaterial,
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

  it('owns and disposes the latest painted weights', async () => {
    const albedo = new Texture()
    const initialWeights = new Texture()
    const textures = [albedo, initialWeights]
    const initialDispose = vi.spyOn(initialWeights, 'dispose')
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
        groundMaterials: [{ albedo: { assetId: 'ground' }, normal: null, channel: 'r' }],
        groundWeights: { assetId: 'weights' },
      },
    )

    syncGroundMaterial(terrain, layer, {
      loadGround: async () => textures[loaded++] ?? new Texture(),
    })
    await vi.waitFor(() => expect(terrain.groundUniforms).toBeDefined())
    applyGroundPaint(terrain, emptyGroundPaint(2, 2))
    const painted = terrain.groundUniforms?.weights.value
    const paintedDispose = painted ? vi.spyOn(painted, 'dispose') : undefined
    disposeGroundMaterial(terrain)

    expect(initialDispose).toHaveBeenCalledOnce()
    expect(paintedDispose).toHaveBeenCalledOnce()
  })

  it('disposes textures loaded beside a failed splat asset', async () => {
    const albedo = new Texture()
    const weights = new Texture()
    const disposeAlbedo = vi.spyOn(albedo, 'dispose')
    const disposeWeights = vi.spyOn(weights, 'dispose')
    let loaded = 0
    const failure = new Error('normal failed')
    const onFailure = vi.fn()
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
          { albedo: { assetId: 'ground' }, normal: { assetId: 'normal' }, channel: 'r' },
        ],
        groundWeights: { assetId: 'weights' },
      },
    )

    syncGroundMaterial(terrain, layer, {
      loadGround: async () => {
        const call = loaded++
        if (call === 1) throw failure
        return call === 0 ? albedo : weights
      },
      onFailure,
    })
    await vi.waitFor(() => expect(onFailure).toHaveBeenCalled())

    expect(disposeAlbedo).toHaveBeenCalledOnce()
    expect(disposeWeights).toHaveBeenCalledOnce()
    expect(terrain.groundUniforms).toBeUndefined()
  })

  it('reloads bindings when an existing material changes channel', async () => {
    const terrain: ReliefGroundMaterial = {
      material: new MeshStandardMaterial(),
      groundAssetId: null,
      groundGeneration: 0,
    }
    const first = reliefLayer(
      { assetId: 'height' },
      {
        id: 'terrain',
        groundMaterials: [{ albedo: { assetId: 'ground' }, normal: null, channel: 'r' }],
        groundWeights: { assetId: 'weights' },
      },
    )
    const loadGround = async () => new Texture()
    syncGroundMaterial(terrain, first, { loadGround })
    await vi.waitFor(() => expect(terrain.groundUniforms).toBeDefined())
    const generation = terrain.groundGeneration

    syncGroundMaterial(
      terrain,
      {
        ...first,
        groundMaterials: [{ albedo: { assetId: 'ground' }, normal: null, channel: 'g' }],
      },
      { loadGround },
    )

    expect(terrain.groundGeneration).toBe(generation + 1)
  })
})

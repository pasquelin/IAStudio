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

  it('keeps a live paint when a slower ground load lands afterwards', async () => {
    let finish!: (texture: Texture) => void
    const loading = new Promise<Texture>(resolve => {
      finish = resolve
    })
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

    syncGroundMaterial(terrain, layer, { loadGround: () => loading })
    applyGroundPaint(terrain, emptyGroundPaint(2, 2))
    const painted = terrain.material.map
    finish(new Texture())
    await Promise.resolve()

    expect(terrain.material.map).toBe(painted)
  })
})

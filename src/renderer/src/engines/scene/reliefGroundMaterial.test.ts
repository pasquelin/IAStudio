import { MeshStandardMaterial, Texture } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { reliefLayer } from '@shared/domain/scene'
import { syncGroundMaterial, type ReliefGroundMaterial } from './reliefGroundMaterial'

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
        groundMaterials: [{ texture: { assetId: 'ground' }, weight: 1 }],
      },
    )

    syncGroundMaterial(terrain, layer, { loadGround: async () => texture })

    await vi.waitFor(() => expect(terrain.material.map).toBe(texture))
  })
})

import { describe, expect, it } from 'vitest'
import { reliefLayer, type GeometryDescriptor } from '@shared/domain/scene'
import { EMPTY_TIMELINE } from '@shared/domain/animation'
import { EMPTY_SCENE } from '@/engines/scene/sceneState'
import { meshNode, modelNode, spriteNode } from '@/engines/scene/nodeFactory'
import { runtimeAssetIds } from './runtimeAssetIds'

describe('assets reachable from an exported runtime', () => {
  it('keeps only assets the standalone runtime reads, once in first-use order', () => {
    const box: GeometryDescriptor = { kind: 'box', width: 1, height: 1, depth: 1 }
    const textured = meshNode(box)
    if (textured.type !== 'mesh') throw new Error('expected a mesh')
    const material = {
      ...textured.material,
      map: { assetId: 'shared' },
      normalMap: { assetId: 'unused-normal' },
    }
    const model = modelNode('model', 'Model')
    const plainSprite = spriteNode()
    if (plainSprite.type !== 'sprite') throw new Error('expected a sprite')
    const sprite = { ...plainSprite, sprite: { ...plainSprite.sprite, map: { assetId: 'shared' } } }

    expect(
      runtimeAssetIds({
        ...EMPTY_SCENE,
        nodes: [{ ...textured, material }, model, sprite],
        world: {
          ...EMPTY_SCENE.world,
          environment: { kind: 'skybox', assetId: 'unused-sky' },
          layers: [reliefLayer({ assetId: 'height' }, { id: 'terrain' })],
        },
        animation: {
          ...EMPTY_TIMELINE,
          audio: [{ id: 'audio', assetId: 'sound', start: 0, duration: 1 }],
          video: [{ id: 'video', assetId: 'movie', start: 0, duration: 1 }],
        },
      }),
    ).toEqual(['shared', 'height', 'sound', 'movie'])
  })
})

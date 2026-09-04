import { describe, expect, it } from 'vitest'
import type { AssetPort } from '@game/ports/assetPort'
import { reliefLayer, scatterLayer } from '@shared/domain/scene'
import { EMPTY_SCENE } from '@/engines/scene/sceneState'
import { buildGameScene } from './gameScene'

const NOTHING: AssetPort = { urlOf: () => null }

function namesOf(scene: { traverse: (fn: (object: { name: string }) => void) => void }): string[] {
  const names: string[] = []
  scene.traverse(object => {
    if (object.name) names.push(object.name)
  })
  return names
}

describe('a game scene draped with world layers', () => {
  it('draws a relief mesh instead of the studio ground when a heightmap is present', async () => {
    const terrain = reliefLayer({ assetId: 'height' }, { id: 'island' })
    const samples = { width: 5, height: 5, values: new Float32Array(25) }
    const built = await buildGameScene(
      { ...EMPTY_SCENE, world: { ...EMPTY_SCENE.world, layers: [terrain] } },
      NOTHING,
      undefined,
      undefined,
      undefined,
      new Map([['height', samples]]),
    )
    expect(namesOf(built.scene).some(name => name.includes('relief'))).toBe(true)
    built.dispose()
  })

  it('keeps a scatter group in the game scene when the world has a scatter layer', async () => {
    const built = await buildGameScene(
      {
        ...EMPTY_SCENE,
        world: {
          ...EMPTY_SCENE.world,
          layers: [scatterLayer({ id: 'trees', assets: [{ assetId: 'pine', weight: 1 }] })],
        },
      },
      NOTHING,
    )
    expect(namesOf(built.scene)).toContain('scene-scatter')
    built.dispose()
  })
})

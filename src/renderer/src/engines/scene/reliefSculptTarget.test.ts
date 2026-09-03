import { describe, expect, it } from 'vitest'
import type { SceneWorld } from '@shared/domain/scene'
import { DEFAULT_WORLD, UNLOCKED_TERRAIN } from '@shared/domain/scene'
import { reliefBrushOf } from './reliefSculptTarget'

function worldWith(edits: SceneWorld['layers'][number]['edits']): SceneWorld {
  return {
    ...DEFAULT_WORLD,
    layers: [
      {
        kind: 'relief',
        id: 'terrain',
        name: 'Terrain',
        enabled: true,
        locked: UNLOCKED_TERRAIN,
        heightmap: { assetId: 'heightmap' },
        origin: { x: 0, z: 0 },
        size: { x: 80, z: 40 },
        elevation: { min: -10, max: 30 },
        grain: 1,
        edits,
      },
    ],
  }
}

describe('reliefBrushOf', () => {
  it('targets the only editable layer with scale-relative defaults', () => {
    expect(
      reliefBrushOf(
        worldWith([{ id: 'detail', name: 'Detail', enabled: true, locked: false, alpha: 1 }]),
      ),
    ).toEqual({ terrainId: 'terrain', editId: 'detail', radius: 1, amount: 0.4 })
  })

  it('refuses an ambiguous or locked target', () => {
    expect(
      reliefBrushOf(
        worldWith([
          { id: 'a', name: 'A', enabled: true, locked: false, alpha: 1 },
          { id: 'b', name: 'B', enabled: true, locked: false, alpha: 1 },
        ]),
      ),
    ).toBeNull()
    expect(
      reliefBrushOf(
        worldWith([{ id: 'locked', name: 'Locked', enabled: true, locked: true, alpha: 1 }]),
      ),
    ).toBeNull()
  })
})

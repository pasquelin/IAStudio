import { describe, expect, it } from 'vitest'
import { newComponent } from '@shared/domain/componentRegistry'
import { createExportHost } from '@game/host/exportHost'
import type { GameApi } from '@game/api/gameApi'
import { meshNode } from '@/engines/scene/scene-fixtures'
import { EMPTY_SCENE, type SceneState } from '@/engines/scene/sceneState'
import { worldFromScene } from './worldFromScene'

const ports = (): GameApi =>
  createExportHost({
    input: new EventTarget(),
    player: { id: 'p1', name: 'Alba', local: true },
    files: {},
  })

const scene = (): SceneState => ({
  ...EMPTY_SCENE,
  nodes: [
    { ...meshNode('a'), name: 'Plate-forme', components: [newComponent('Movement')] },
    meshNode('b'),
  ],
})

describe('the edit state, translated into something that runs', () => {
  it('carries every object, with its name and what it does', () => {
    const world = worldFromScene('doc-1', scene(), ports())

    expect([...world.entities.all()].map(entity => entity.id)).toEqual(['a', 'b'])
    expect(world.entities.get('a')?.name).toBe('Plate-forme')
    expect(world.entities.get('a')?.components).toEqual([newComponent('Movement')])
    expect([...world.entities.withComponent('Movement')].map(one => one.id)).toEqual(['a'])
  })

  /**
   * 🛑 The whole safety of Play Mode. A world writing positions in place would edit the scene the
   * user is editing, and STOP would have something to restore — which is exactly what it must not.
   */
  it('copies every vector, so a step cannot reach the document', () => {
    const state = scene()
    const world = worldFromScene('doc-1', state, ports())
    const entity = world.entities.get('a')
    if (!entity) throw new Error('no entity')

    entity.transform.position.y = 42
    entity.components = []

    expect(state.nodes[0]?.transform.position.y).toBe(0)
    expect(state.nodes[0]?.components).toEqual([newComponent('Movement')])
  })

  it('names the document it came from, so an entity can be referenced in full', () => {
    expect(worldFromScene('doc-1', scene(), ports()).scene).toEqual({
      kind: 'document',
      id: 'doc-1',
    })
  })
})

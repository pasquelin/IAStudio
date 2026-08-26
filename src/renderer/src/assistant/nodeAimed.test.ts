import { describe, expect, it } from 'vitest'
import { meshNode } from '@/engines/scene/scene-fixtures'
import { EMPTY_SCENE, type SceneNode } from '@/engines/scene/sceneState'
import { nodeAimed } from './nodeAimed'

const named = (id: string, name: string): SceneNode => ({ ...meshNode(id), name })

const scene = (...nodes: SceneNode[]) => ({ ...EMPTY_SCENE, nodes })

describe('the node a caller meant', () => {
  it('answers by id, and by a name only one node carries', () => {
    const state = scene(named('n-1', 'Cube Test'), named('n-2', 'Sphere'))

    expect(nodeAimed(state, 'n-1')?.id).toBe('n-1')
    expect(nodeAimed(state, 'Cube Test')?.id).toBe('n-1')
    expect(nodeAimed(state, 'nothing')).toBeUndefined()
  })

  // A guess between two would edit the wrong object, and answer `ok` for it.
  it('answers nothing when two nodes share the name', () => {
    expect(nodeAimed(scene(named('n-1', 'Cube'), named('n-2', 'Cube')), 'Cube')).toBeUndefined()
  })
})

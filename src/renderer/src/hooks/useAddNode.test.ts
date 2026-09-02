import { beforeEach, describe, expect, it } from 'vitest'
import { EMPTY_SCENE } from '@/engines/scene/sceneState'
import { PLAYER_KIND } from '@/engines/scene/playerModule'
import { installScene } from '@/stores/scene-fixtures'
import { sceneOf, useScenes } from '@/stores/scenes'
import { addNodeTo } from './useAddNode'

const DOCUMENT = 'doc-1'

const picked = () => sceneOf(useScenes.getState(), DOCUMENT).selectedIds

describe('what an Add leaves picked', () => {
  beforeEach(() => {
    installScene(DOCUMENT, EMPTY_SCENE)
  })

  it('picks the one node it put down', () => {
    addNodeTo(DOCUMENT, 'box')

    expect(picked()).toHaveLength(1)
  })

  /**
   * 🛑 `addNodes` picks EVERYTHING it put down, which is right for a duplicate and wrong for a
   * module: the next gesture would paint the arm and the camera along with the body.
   */
  it('picks the module alone, not the four nodes hanging from it', () => {
    addNodeTo(DOCUMENT, PLAYER_KIND)

    const scene = sceneOf(useScenes.getState(), DOCUMENT)
    expect(picked()).toHaveLength(1)
    expect(scene.nodes.find(node => node.id === picked()[0])?.name).toBe('Player_Module')
  })
})

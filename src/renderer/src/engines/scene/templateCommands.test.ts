import { describe, expect, it } from 'vitest'
import { GAME_TEMPLATES, gameTemplate } from '@shared/domain/gameTemplate'
import { emptyHistory, run } from '@/engines/core/history'
import { createDefaultScene } from './defaultScene'
import { layOutTemplate } from './templateCommands'
import type { SceneState } from './sceneState'

const laid = (id: string): { before: SceneState; state: SceneState; back: SceneState } => {
  const template = gameTemplate(id)
  if (!template) throw new Error(`no template ${id}`)

  // Held rather than rebuilt: a new scene mints new node ids, so a second one compares nothing.
  const before = createDefaultScene()
  const command = layOutTemplate(template)
  const [state] = run(before, emptyHistory<SceneState>(), command)
  return { before, state, back: command.revert(state) }
}

/** 🛑 The lot's own criterion: a template gives a jouable scene without a line of code. */
describe('a game template laid out in a scene', () => {
  it('puts down what it declares, and nothing else', () => {
    const { before, state } = laid('thirdPerson')

    expect(state.nodes.map(node => node.name)).toEqual([
      ...before.nodes.map(node => node.name),
      'Sol',
      'Personnage',
      'Caisse',
      'Caisse 2',
    ])
  })

  /** Half of what a template MEANS: third person with an orbit camera does nothing at all. */
  it('sets how the scene is watched and walked', () => {
    const { state } = laid('thirdPerson')

    expect(state.world.play.camera).toBe('thirdPerson')
    expect(state.world.play.gravity).toBeGreaterThan(0)
  })

  it('gives the scene back whole on one undo, camera included', () => {
    const { before, back } = laid('thirdPerson')

    expect(back.nodes).toEqual(before.nodes)
    expect(back.world.play).toEqual(before.world.play)
  })

  it('hands every piece the components it was declared with', () => {
    const { state } = laid('thirdPerson')
    const hero = state.nodes.find(node => node.name === 'Personnage')

    expect(hero?.components?.map(one => one.type)).toEqual(['CharacterController', 'Health'])
  })

  /** A setting a template asks for wins over the registry's own default. */
  it('lays a floor whose collider is the box the template asked for', () => {
    const { state } = laid('thirdPerson')
    const floor = state.nodes.find(node => node.name === 'Sol')

    expect(floor?.components?.[0]).toMatchObject({ type: 'Collider', fidelity: 'box' })
  })

  it.each(GAME_TEMPLATES.map(one => one.id))('lays out %s without repeating a node id', id => {
    const { state } = laid(id)
    const ids = state.nodes.map(node => node.id)

    expect(new Set(ids).size).toBe(ids.length)
  })
})

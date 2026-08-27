import { describe, expect, it } from 'vitest'
import { emptyHistory, run } from '@/engines/core/history'
import { createDefaultScene } from './defaultScene'
import { sceneFromTemplate } from './sceneTemplates'
import { layOutTemplate } from './templateCommands'
import type { SceneState } from './sceneState'

const laid = (): { before: SceneState; state: SceneState; back: SceneState } => {
  // Held rather than rebuilt: a new scene mints new node ids, so a second one compares nothing.
  const before: SceneState = {
    ...createDefaultScene(),
    world: { ...createDefaultScene().world, background: { kind: 'color', color: '#ff00ff' } },
  }
  const command = layOutTemplate('thirdPerson')
  const [state] = run(before, emptyHistory<SceneState>(), command)
  return { before, state, back: command.revert(state) }
}

describe('a game template laid out in the scene in front', () => {
  it('adds what the template builds on top of what was already there, and selects it', () => {
    const { before, state } = laid()

    expect(state.nodes).toHaveLength(
      before.nodes.length + sceneFromTemplate('thirdPerson').nodes.length,
    )
    expect(state.selectedIds).toHaveLength(sceneFromTemplate('thirdPerson').nodes.length)
  })

  /** Half of what a template MEANS: third person with an orbit camera does nothing at all. */
  it('sets how the scene is watched and walked, and repaints nothing else', () => {
    const { before, state } = laid()

    expect(state.world.play.camera).toBe('thirdPerson')
    expect(state.world.play.gravity).toBeGreaterThan(0)
    expect(state.world.background).toEqual(before.world.background)
  })

  it('gives the scene back whole on one undo, camera included', () => {
    const { before, back } = laid()

    expect(back.nodes).toEqual(before.nodes)
    expect(back.world).toEqual(before.world)
  })
})

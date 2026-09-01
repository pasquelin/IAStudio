import { describe, expect, it } from 'vitest'
import { newComponent } from '@shared/domain/componentRegistry'
import { attachComponent, detachComponent, setComponentField } from './commands'
import { meshNode } from './scene-fixtures'
import { EMPTY_SCENE, nodeById, type SceneState } from './sceneState'

const scene = (): SceneState => ({ ...EMPTY_SCENE, nodes: [meshNode('a')] })

const componentsOf = (state: SceneState) => nodeById(state, 'a')?.components

describe('giving an object something to do', () => {
  it('attaches a component at its defaults, and takes it back on revert', () => {
    const command = attachComponent('a', 'Health')
    const after = command.apply(scene())

    expect(componentsOf(after)).toEqual([newComponent('Health')])
    expect(command.revert(after)).toEqual(scene())
  })

  /** A second `Health` would leave the winner to whichever system read first — and lose values. */
  it('refuses a type the object already carries', () => {
    const held = attachComponent('a', 'Health').apply(scene())
    const hurt = setComponentField('a', 'Health', 'current', 3).apply(held)

    expect(attachComponent('a', 'Health').refuses?.(hurt)).toBe(true)
  })

  it('writes one field of one component, leaving the others where they were', () => {
    const held = attachComponent('a', 'Health').apply(scene())
    const hurt = setComponentField('a', 'Health', 'current', 3).apply(held)

    expect(componentsOf(hurt)).toEqual([{ ...newComponent('Health'), current: 3 }])
  })

  it('detaches one, and refuses to detach one the object has not got', () => {
    const held = attachComponent('a', 'Health').apply(scene())

    expect(componentsOf(detachComponent('a', 'Health').apply(held))).toEqual([])
    expect(detachComponent('a', 'Movement').refuses?.(held)).toBe(true)
  })

  /** An object that never carried one must not gain an empty list, which would cost an undo. */
  it('refuses every gesture on an object with no components at all', () => {
    const bare = scene()

    expect(detachComponent('a', 'Health').refuses?.(bare)).toBe(true)
    expect(setComponentField('a', 'Health', 'current', 3).refuses?.(bare)).toBe(true)
  })
})

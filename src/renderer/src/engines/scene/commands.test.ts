import { describe, expect, it } from 'vitest'
import { emptyHistory, run, undo } from '../core/history'
import { addObject, multi, removeObject, selectObject, setTransform } from './commands'
import { EMPTY_SCENE, IDENTITY_TRANSFORM, objectById, type SceneObject } from './scene-state'

const box: SceneObject = {
  id: 'box-1',
  kind: 'box',
  name: 'Box',
  transform: IDENTITY_TRANSFORM,
}

const moved = { ...IDENTITY_TRANSFORM, position: { x: 5, y: 0, z: 0 } }

describe('addObject', () => {
  it('adds the object and selects it', () => {
    const state = addObject(box).apply(EMPTY_SCENE)
    expect(state.objects).toHaveLength(1)
    expect(state.selectedId).toBe('box-1')
  })

  it('reverts to the scene without it', () => {
    const command = addObject(box)
    expect(command.revert(command.apply(EMPTY_SCENE))).toEqual(EMPTY_SCENE)
  })
})

describe('removeObject', () => {
  it('drops the object and clears the selection that pointed at it', () => {
    const withBox = addObject(box).apply(EMPTY_SCENE)
    const state = removeObject('box-1').apply(withBox)
    expect(state.objects).toHaveLength(0)
    expect(state.selectedId).toBeNull()
  })

  it('puts the object back at its original index', () => {
    const first = addObject(box).apply(EMPTY_SCENE)
    const second = addObject({ ...box, id: 'box-2' }).apply(first)
    const command = removeObject('box-1')
    const restored = command.revert(command.apply(second))
    expect(restored.objects.map(object => object.id)).toEqual(['box-1', 'box-2'])
  })

  it('does nothing for an unknown id', () => {
    expect(removeObject('ghost').apply(EMPTY_SCENE)).toEqual(EMPTY_SCENE)
  })
})

describe('setTransform', () => {
  it('moves the object', () => {
    const withBox = addObject(box).apply(EMPTY_SCENE)
    const state = setTransform('box-1', moved).apply(withBox)
    expect(objectById(state, 'box-1')?.transform.position.x).toBe(5)
  })

  it('reverts to the transform the object had when the command was built', () => {
    const withBox = addObject(box).apply(EMPTY_SCENE)
    const command = setTransform('box-1', moved)
    const back = command.revert(command.apply(withBox))
    expect(objectById(back, 'box-1')?.transform).toEqual(IDENTITY_TRANSFORM)
  })
})

describe('multi', () => {
  it('applies every command in order and reverts them backwards', () => {
    const command = multi('add-two', [addObject(box), addObject({ ...box, id: 'box-2' })])
    const applied = command.apply(EMPTY_SCENE)
    expect(applied.objects).toHaveLength(2)
    expect(command.revert(applied)).toEqual(EMPTY_SCENE)
  })
})

describe('selectObject', () => {
  it('selects and deselects without touching the objects', () => {
    const withBox = addObject(box).apply(EMPTY_SCENE)
    expect(selectObject(withBox, null).selectedId).toBeNull()
    expect(selectObject(withBox, 'box-1').objects).toEqual(withBox.objects)
  })
})

describe('through the history', () => {
  it('undoes a move back to where it was', () => {
    const withBox = addObject(box).apply(EMPTY_SCENE)
    const [applied, history] = run(withBox, emptyHistory(), setTransform('box-1', moved))
    const [back] = undo(applied, history)
    expect(objectById(back, 'box-1')?.transform).toEqual(IDENTITY_TRANSFORM)
  })
})

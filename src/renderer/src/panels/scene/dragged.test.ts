import { describe, expect, it } from 'vitest'
import { draggedSceneNodesOf } from './dragged'

/*
 * The payload crosses a `dataTransfer` as text, so nothing about it is typed on arrival. Read
 * rather than trusted: a drag from another application carries whatever it likes under a type
 * name it chose, and the band would otherwise put ids that are not ids on the sheet.
 */
describe('what the outliner hands the band', () => {
  it('reads the ids of the objects dragged', () => {
    expect(draggedSceneNodesOf({ nodeIds: ['walker', 'house'] })).toEqual({
      nodeIds: ['walker', 'house'],
    })
  })

  it('keeps the strings and drops what is not one', () => {
    expect(draggedSceneNodesOf({ nodeIds: ['walker', 7, null, 'house'] })).toEqual({
      nodeIds: ['walker', 'house'],
    })
  })

  it('answers nothing for a payload that names no object at all', () => {
    expect(draggedSceneNodesOf({ nodeIds: [] })).toBeNull()
    expect(draggedSceneNodesOf({ nodeIds: [7, null] })).toBeNull()
  })

  it('answers nothing for a payload of another shape entirely', () => {
    expect(draggedSceneNodesOf({ kind: 'embedded', clip: 'walk' })).toBeNull()
    expect(draggedSceneNodesOf('walker')).toBeNull()
    expect(draggedSceneNodesOf(null)).toBeNull()
  })
})

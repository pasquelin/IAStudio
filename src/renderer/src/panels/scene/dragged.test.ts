import { describe, expect, it } from 'vitest'
import { sceneNodeDrag } from './dragged'

const armed = () => ({
  dataTransfer: {
    effectAllowed: 'uninitialized' as string,
    types: [] as string[],
    setData: () => undefined,
    getData: () => '',
  },
})

/*
 * One row, two gestures: dropped on another row it REPARENTS (a move), dropped on the band it
 * ADDS (a copy, and the effect that draws the `+`). A target may only ask for an effect its
 * source allowed, and `Tree` arms its own channel before this one — `copy` alone overwrote that
 * and left every reparenting drag refused in SILENCE, which jsdom does not model.
 */
describe('dragging an object of the outliner', () => {
  it('allows both, because one row is dropped on the band AND on another row', () => {
    const event = armed()
    sceneNodeDrag.start(event as never, ['walker'])

    expect(event.dataTransfer.effectAllowed).toBe('copyMove')
  })
})

import { describe, expect, it } from 'vitest'
import { IDENTITY_TRANSFORM, movedParts } from './transform'

/**
 * What crosses to a model, and why it is trimmed: a node merely moved carried its unturned
 * rotation and its unscaled scale for 78 characters, in the one member of `scene.state` that was
 * being dropped whole for want of room.
 */
describe('the parts of a transform that have moved', () => {
  it('answers nothing at all for a thing left where a fresh one stands', () => {
    expect(movedParts(IDENTITY_TRANSFORM)).toEqual({})
  })

  it('answers the moved part alone, and leaves the two at rest out', () => {
    const moved = movedParts({ ...IDENTITY_TRANSFORM, position: { x: 5, y: 0, z: 0 } })

    expect(moved).toEqual({ position: { x: 5, y: 0, z: 0 } })
  })

  /** One axis is enough — a walk that compared whole vectors by identity would miss it. */
  it('answers every part that differs on any single axis', () => {
    const moved = movedParts({
      position: { x: 0, y: 1, z: 0 },
      rotation: { x: 0, y: 0, z: 0.5 },
      scale: { x: 1, y: 1, z: 2 },
    })

    expect(Object.keys(moved).sort()).toEqual(['position', 'rotation', 'scale'])
  })
})

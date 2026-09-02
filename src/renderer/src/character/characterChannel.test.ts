import { describe, expect, it } from 'vitest'
import { IDENTITY_TRANSFORM } from '@shared/domain/transform'
import { characterMessageOf } from './characterChannel'

const RIG = { origin: 'local', bones: [{ name: 'Hips', parent: null, rest: IDENTITY_TRANSFORM }] }
const BOUNDS = { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 2, z: 1 } }

describe('what the skeleton window and the studio say to each other', () => {
  it('carries the character being held, its skeleton and what it measures', () => {
    const held = { kind: 'holds', assetId: 'a1', rig: RIG, bounds: BOUNDS }

    expect(characterMessageOf(held)).toEqual(held)
  })

  it('carries a character that has no skeleton yet', () => {
    expect(characterMessageOf({ kind: 'holds', assetId: 'a1', rig: null, bounds: BOUNDS })).toEqual(
      {
        kind: 'holds',
        assetId: 'a1',
        rig: null,
        bounds: BOUNDS,
      },
    )
  })

  // A `BroadcastChannel` is reachable by anything on this origin: what arrives is checked, never
  // trusted — a stranger would otherwise reach the store the assistant reads.
  it('reads nothing out of a message that is not one', () => {
    expect(characterMessageOf({ kind: 'holds', assetId: '', rig: null, bounds: null })).toBeNull()
    expect(characterMessageOf({ kind: 'holds', assetId: 'a1', rig: { bones: 'no' } })).toBeNull()
    expect(characterMessageOf({ kind: 'sing', assetId: 'a1' })).toBeNull()
    expect(characterMessageOf('holds')).toBeNull()
    expect(characterMessageOf(null)).toBeNull()
  })

  // A rig whose bones break an invariant of their own is one the reader drops: letting it cross
  // would put a state in the studio that no document could ever hold.
  it('reads nothing out of a skeleton that would not hold', () => {
    const broken = {
      origin: 'local',
      bones: [{ name: 'A', parent: 'B', rest: IDENTITY_TRANSFORM }],
    }

    expect(
      characterMessageOf({ kind: 'holds', assetId: 'a1', rig: broken, bounds: null }),
    ).toBeNull()
  })

  it('says a character was let go, so nothing keeps answering for it', () => {
    expect(characterMessageOf({ kind: 'dropped', assetId: 'a1' })).toEqual({
      kind: 'dropped',
      assetId: 'a1',
    })
  })
})

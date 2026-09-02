import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EMPTY_TIMELINE, type AnimationTimeline } from '@shared/domain/animation'
import type { Asset } from '@shared/domain/asset'
import { installFakeBridge } from '@/services/fakeBridge'
import { clearCharacters } from '@/stores/character-fixtures'
import { characterOf, seedCharacter, useCharacters } from '@/stores/character'
import { hasMotion, saveCharacterMotion } from './characterMotion'

const ASSET = 'asset-hero'

const keyed: AnimationTimeline = {
  ...EMPTY_TIMELINE,
  tracks: [
    {
      id: 'track-1',
      name: 'Spine',
      index: 0,
      muted: false,
      solo: false,
      locked: false,
      target: { nodeId: 'node-1', bone: 'Spine', property: 'position' },
      keys: [{ time: 0, value: { x: 0, y: 0, z: 0 } }],
    },
  ],
}

beforeEach(() => {
  clearCharacters()
  installFakeBridge()
})

describe('the motion a band plays, filed as a project asset', () => {
  // A file claiming an animation it does not have is worse than no file at all.
  it('says there is nothing to file while no channel holds a key', () => {
    expect(hasMotion(EMPTY_TIMELINE)).toBe(false)
    expect(hasMotion({ ...keyed, tracks: [{ ...keyed.tracks[0]!, keys: [] }] })).toBe(false)
    expect(hasMotion(keyed)).toBe(true)
  })

  /**
   * 🛑 A REFERENCE and never a copy: the same file plays on every character whose bones carry
   * the same names, which is the whole reason motions are files.
   */
  it('files the bytes as a new asset, then teaches that motion to the character', async () => {
    const filed: Asset = {
      id: 'asset-walk',
      name: 'Marche',
      type: 'animation',
      location: 'local',
      tags: [],
      createdAt: '2026-09-02T00:00:00.000Z',
    }
    const saveAnimation = vi.fn(() => Promise.resolve(filed))
    installFakeBridge({ assets: { saveAnimation } })
    seedCharacter(ASSET, null, {})

    expect(await saveCharacterMotion(ASSET, 'Marche', new Uint8Array([1, 2]))).toBe(true)

    expect(saveAnimation).toHaveBeenCalledWith({
      name: 'Marche',
      derivedFrom: ASSET,
      glb: new Uint8Array([1, 2]),
    })
    expect(characterOf(useCharacters.getState(), ASSET).motions).toEqual([
      { id: expect.any(String), name: 'Marche', assetId: 'asset-walk' },
    ])
  })
})

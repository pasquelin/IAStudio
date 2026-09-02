import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EMPTY_TIMELINE, SCENE_SUBJECT_ID, type AnimationTimeline } from '@shared/domain/animation'
import type { Asset } from '@shared/domain/asset'
import { installFakeBridge } from '@/services/fakeBridge'
import { clearCharacters } from '@/stores/character-fixtures'
import { characterOf, seedCharacter, useCharacters } from '@/stores/character'
import { STUDIO_METADATA_KEY } from '@shared/domain/studioMetadata'
import { motionFile } from './characterMotion-fixtures'
import { hasMotion, motionExtras, motionTimelineOf, saveCharacterMotion } from './characterMotion'

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

    expect(await saveCharacterMotion(ASSET, 'Marche', new Uint8Array([1, 2]))).toBe('asset-walk')

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

describe('a motion taken back onto the band', () => {
  it('gives back the very keys that were posed, aimed at the node that plays them here', () => {
    const read = motionTimelineOf(motionFile(motionExtras(keyed)), 'node-9')

    expect(read?.tracks).toEqual([
      { ...keyed.tracks[0], target: { ...keyed.tracks[0]!.target, nodeId: 'node-9' } },
    ])
    expect(read?.duration).toBe(keyed.duration)
    expect(read?.fps).toBe(keyed.fps)
  })

  // A motion is a file no character owns: the same one plays on the next character, whose
  // workshop mints a node of its own. Bone NAMES are what the two have in common, never ids.
  it('puts the sheet on that node too, and keeps the scene subject where it stands', () => {
    const band = { ...keyed, sheet: ['node-1', SCENE_SUBJECT_ID] }

    expect(motionTimelineOf(motionFile(motionExtras(band)), 'node-9')?.sheet).toEqual([
      'node-9',
      SCENE_SUBJECT_ID,
    ])
  })

  // Every motion the project holds is offered, and most were never posed here — a file from a
  // library carries a clip and no band at all. Answering with an empty one would empty the bench.
  it('answers nothing for a file this studio did not write the band of', () => {
    expect(motionTimelineOf(motionFile({}), 'node-9')).toBeNull()
    expect(motionTimelineOf(motionFile({ [STUDIO_METADATA_KEY]: {} }), 'node-9')).toBeNull()
    expect(motionTimelineOf(new Uint8Array([1, 2, 3]), 'node-9')).toBeNull()
  })
})

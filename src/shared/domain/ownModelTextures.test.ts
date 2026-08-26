import { describe, expect, it } from 'vitest'
import type { Asset } from './asset'
import type { PbrChannel } from './material'
import { effectiveModelTextures, ownModelTextures } from './ownModelTextures'

const MODEL = 'asset-model'

function picture(id: string, map: PbrChannel | undefined): Asset {
  return {
    id,
    name: `Robot — ${map ?? 'sans canal'}`,
    type: 'texture',
    location: 'local',
    derivedFrom: MODEL,
    tags: [],
    createdAt: '2026-08-13T10:00:00.000Z',
    ...(map ? { map } : {}),
  }
}

describe('the pictures a model shed', () => {
  it('dresses the slot each channel names', () => {
    expect(ownModelTextures([picture('base', 'baseColor'), picture('bump', 'normal')])).toEqual({
      map: { assetId: 'base' },
      normalMap: { assetId: 'bump' },
    })
  })

  /**
   * Extraction labels four channels and a scene reads five slots, so the two lists do not meet:
   * emission has nowhere to land, and a picture with no channel at all says nothing.
   */
  it('leaves out a picture no slot of a scene reads', () => {
    expect(
      ownModelTextures([
        picture('base', 'baseColor'),
        picture('glow', 'emissive'),
        picture('packed', undefined),
      ]),
    ).toEqual({ map: { assetId: 'base' } })
  })

  it('answers nothing when no picture dresses a slot', () => {
    expect(ownModelTextures([picture('glow', 'emissive')])).toBeUndefined()
  })

  /**
   * A `.glb` of two materials yields two base colours, and a model node has no name to hang a
   * per-material override on — so the honest answer is none rather than the first one seen.
   */
  it('refuses to choose when two pictures claim the same slot', () => {
    expect(
      ownModelTextures([picture('base', 'baseColor'), picture('other', 'baseColor')]),
    ).toBeUndefined()
  })
})

describe('what a model node actually wears', () => {
  it('lets a slot somebody filled beat the picture the file shed', () => {
    expect(
      effectiveModelTextures({ map: { assetId: 'chosen' } }, { map: { assetId: 'shed' } }),
    ).toEqual({ map: { assetId: 'chosen' } })
  })

  it('fills the slots the node names nothing for', () => {
    expect(
      effectiveModelTextures({ map: { assetId: 'chosen' } }, { normalMap: { assetId: 'shed' } }),
    ).toEqual({ map: { assetId: 'chosen' }, normalMap: { assetId: 'shed' } })
  })

  it('leaves the node alone when its file shed nothing', () => {
    expect(effectiveModelTextures({ map: { assetId: 'chosen' } }, undefined)).toEqual({
      map: { assetId: 'chosen' },
    })
  })
})

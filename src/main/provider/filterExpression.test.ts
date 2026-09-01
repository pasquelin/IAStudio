import { describe, expect, it } from 'vitest'
import { CLOUD_ASSET_TYPES, type CloudAssetType } from '@shared/domain/asset'
import { assetTypeOfRemote } from '@shared/domain/assetKind'
import { filterExpression, publicFeedFilter } from './filterExpression'
import { remoteTypesFor } from './remoteTypes'

describe('the filter a search is narrowed by', () => {
  it('asks for nothing when nothing narrows anything', () => {
    // An empty filter and no filter mean the same thing; sending `""` risks a 400 for nothing.
    expect(filterExpression({})).toBeUndefined()
    expect(filterExpression({ tags: [] })).toBeUndefined()
  })

  it('joins tags with AND, because filters narrow', () => {
    expect(filterExpression({ tags: ['hero', 'stone'] })).toBe('tags = "hero" AND tags = "stone"')
  })

  it('joins kinds with OR, because asking for two means either', () => {
    expect(filterExpression({ types: ['image', 'audio'] })).toBe(
      '(kind = "image" OR kind = "audio")',
    )
  })

  it('collapses the kinds our types share', () => {
    // A sky is a picture to the API; asking for both is one clause.
    expect(filterExpression({ types: ['image', 'skybox'] })).toBe('kind = "image"')
  })

  it('narrows to a collection', () => {
    expect(filterExpression({ collectionId: 'col_1' })).toBe('collectionIds = "col_1"')
  })

  it('escapes a value that would otherwise close the quote', () => {
    expect(filterExpression({ tags: ['say "hi"'] })).toBe('tags = "say \\"hi\\""')
  })

  it('escapes the backslash before the quotes, not after', () => {
    // The other order would put backslashes in front of the escapes it had just written.
    expect(filterExpression({ tags: ['back\\slash'] })).toBe('tags = "back\\\\slash"')
  })

  it('joins every kind of clause with AND', () => {
    expect(filterExpression({ tags: ['hero'], types: ['audio'], collectionId: 'col_1' })).toBe(
      'tags = "hero" AND kind = "audio" AND collectionIds = "col_1"',
    )
  })
})

describe('the provenance values that stand for our kinds', () => {
  /**
   * The API's thirteen `texture-*` values fall in the picture residue since the studio dropped
   * that kind, and the residue is asked for by asking for NO filter — listing its forty-odd
   * values would drop every new one the API invents.
   */
  it('asks for no filter at all when pictures are wanted', () => {
    expect(remoteTypesFor(['image'])).toBeUndefined()
  })

  it('names the skies, which the API files as ordinary images', () => {
    expect(remoteTypesFor(['skybox'])).toEqual([
      'skybox-base-360',
      'skybox-hdri',
      'skybox-3d',
      'upscale-skybox',
    ])
  })

  it('drops the pictures from a mixed ask and filters on the rest', () => {
    expect(remoteTypesFor(['image', 'mesh'])).toEqual([
      'img23d',
      'txt23d',
      'video23d',
      '3d23d',
      'img2splat',
      'uploaded-3d',
    ])
  })

  it('asks for no filter when nothing was asked for', () => {
    expect(remoteTypesFor(undefined)).toBeUndefined()
    expect(remoteTypesFor([])).toBeUndefined()
  })

  it('merges the values of several kinds at once', () => {
    const both = remoteTypesFor(['mesh', 'audio'])
    expect(both).toContain('img23d')
    expect(both).toContain('txt2audio')
  })
})

describe('the filter the public feed is narrowed by', () => {
  it('drops what the API flagged, whatever the kind', () => {
    // The kinds the feed publishes, which is not every kind the studio knows: there is no
    // animation class over there, so no tab could ever ask for one.
    for (const type of CLOUD_ASSET_TYPES) {
      expect(publicFeedFilter(type)).toContain('nsfw IS EMPTY')
    }
  })

  it('asks the index for one media class', () => {
    expect(publicFeedFilter('video')).toBe('nsfw IS EMPTY AND kind = "video"')
    expect(publicFeedFilter('mesh')).toBe('nsfw IS EMPTY AND kind = "3d"')
  })

  /**
   * A sky alone. The channels of a material stay in: they ARE pictures here, which is the whole
   * of the studio's answer since the kind was dropped.
   */
  it('keeps skies out of the pictures they share a kind with', () => {
    expect(publicFeedFilter('image')).toBe(
      'nsfw IS EMPTY AND kind = "image" AND NOT metadata.type CONTAINS "skybox"',
    )
  })

  it('asks for skies by provenance, which is the only thing that names them', () => {
    expect(publicFeedFilter('skybox')).toBe('nsfw IS EMPTY AND metadata.type CONTAINS "skybox"')
  })

  /**
   * The one that matters. `CONTAINS` is not decoration: a sky arrives as `skybox-base-360`,
   * `skybox-hdri` or `upscale-skybox`, and the tempting `STARTS WITH` — the only other operator
   * the API honours, since `ENDS WITH` answers 500 — would silently lose the last of those
   * three. The feed may over-catch, because the hits are typed again on arrival; it may never
   * under-catch, because nothing downstream can recover an asset the index was not asked for.
   */
  it('catches every provenance the studio files as a sky', () => {
    const byProvenance: CloudAssetType[] = ['skybox']

    for (const type of byProvenance) {
      const filter = publicFeedFilter(type)

      for (const remoteType of remoteTypesFor([type]) ?? []) {
        expect(filter).toContain(`CONTAINS "${type}"`)
        expect(remoteType).toContain(type)
      }
    }
  })
})

describe('a listing narrowed to one collection', () => {
  it('names no kinds when none were asked for', () => {
    expect(filterExpression({ collectionId: 'col_1', types: [] })).toBe('collectionIds = "col_1"')
  })
})

describe('the round trip between what we ask for and what comes back', () => {
  // The two directions are not inverses — eighty values collapse into six on the way in — but
  // a value we send as a filter must come back as the kind we asked for, or the shelf shows
  // what it did not request. Nothing enforced that before this test.
  it('reads every filtered provenance back as the kind it stands for', () => {
    const kinds: CloudAssetType[] = ['skybox', 'mesh', 'video', 'audio']

    for (const kind of kinds) {
      for (const remoteType of remoteTypesFor([kind]) ?? []) {
        expect(assetTypeOfRemote({ metadataType: remoteType })).toBe(kind)
      }
    }
  })
})

import { describe, expect, it } from 'vitest'
import { ASSET_TYPES, type AssetType } from '@shared/domain/asset'
import { assetTypeOfRemote } from '@shared/domain/asset-kind'
import { filterExpression, publicFeedFilter } from './filter-expression'
import { remoteTypesFor } from './remote-types'

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
    // A texture and a sky are both pictures to the API; asking for all three is one clause.
    expect(filterExpression({ types: ['image', 'texture', 'skybox'] })).toBe('kind = "image"')
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
  it('names every type a material can arrive under', () => {
    const textures = remoteTypesFor(['texture'])
    expect(textures).toContain('texture-albedo')
    expect(textures).toContain('texture-smoothness')
    expect(textures).toContain('3d-texture-roughness')
  })

  it('names the skies, which the API files as ordinary images', () => {
    expect(remoteTypesFor(['skybox'])).toEqual([
      'skybox-base-360',
      'skybox-hdri',
      'skybox-3d',
      'upscale-skybox',
    ])
  })

  it('asks for no filter at all when pictures are wanted', () => {
    // Pictures are the residue: enumerating them would drop every type the API later invents.
    expect(remoteTypesFor(['image'])).toBeUndefined()
    expect(remoteTypesFor(['image', 'mesh'])).toBeUndefined()
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
    for (const type of ASSET_TYPES) {
      expect(publicFeedFilter(type)).toContain('nsfw IS EMPTY')
    }
  })

  it('asks the index for one media class', () => {
    expect(publicFeedFilter('video')).toBe('nsfw IS EMPTY AND kind = "video"')
    expect(publicFeedFilter('mesh')).toBe('nsfw IS EMPTY AND kind = "3d"')
  })

  it('keeps materials and skies out of the pictures they share a kind with', () => {
    expect(publicFeedFilter('image')).toBe(
      'nsfw IS EMPTY AND kind = "image"' +
        ' AND NOT metadata.type CONTAINS "texture"' +
        ' AND NOT metadata.type CONTAINS "skybox"',
    )
  })

  it('asks for materials and skies by provenance, which is the only thing that names them', () => {
    expect(publicFeedFilter('texture')).toBe('nsfw IS EMPTY AND metadata.type CONTAINS "texture"')
    expect(publicFeedFilter('skybox')).toBe('nsfw IS EMPTY AND metadata.type CONTAINS "skybox"')
  })

  /**
   * The one that matters. `CONTAINS` is not decoration: a material arrives as `texture`,
   * `upscale-texture` or `3d-texture-roughness`, and the tempting `STARTS WITH` — the only other
   * operator the API honours, since `ENDS WITH` answers 500 — would silently lose two of those
   * three. The feed may over-catch, because the hits are typed again on arrival; it may never
   * under-catch, because nothing downstream can recover an asset the index was not asked for.
   */
  it('catches every provenance the studio files as a material or a sky', () => {
    const byProvenance: AssetType[] = ['texture', 'skybox']

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
    const kinds: AssetType[] = ['texture', 'skybox', 'mesh', 'video', 'audio']

    for (const kind of kinds) {
      for (const remoteType of remoteTypesFor([kind]) ?? []) {
        expect(assetTypeOfRemote({ metadataType: remoteType })).toBe(kind)
      }
    }
  })
})

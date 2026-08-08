import { describe, expect, it } from 'vitest'
import type { AssetType } from '@shared/domain/asset'
import { assetTypeOfRemote } from '@shared/domain/asset-kind'
import { filterExpression } from './filter-expression'
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

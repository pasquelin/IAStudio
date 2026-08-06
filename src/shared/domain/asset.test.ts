import { describe, expect, it } from 'vitest'
import { assetIdFromUrl, assetUrl, isAssetType } from './asset'

describe('asset URLs', () => {
  it('round-trips an identifier', () => {
    expect(assetIdFromUrl(assetUrl('asset_1'))).toBe('asset_1')
  })

  it('survives an identifier needing encoding', () => {
    expect(assetIdFromUrl(assetUrl('asset/1 2'))).toBe('asset/1 2')
  })

  it('refuses a URL that is not ours to serve', () => {
    expect(assetIdFromUrl('https://cdn.cloud.scenario.com/asset_1')).toBeNull()
    expect(assetIdFromUrl('scenario://other/asset_1')).toBeNull()
    expect(assetIdFromUrl('scenario://asset/')).toBeNull()
    expect(assetIdFromUrl('not a url')).toBeNull()
  })
})

describe('asset types', () => {
  it('recognises the declared types and nothing else', () => {
    expect(isAssetType('mesh')).toBe(true)
    expect(isAssetType('skybox')).toBe(true)
    expect(isAssetType('hologram')).toBe(false)
    expect(isAssetType(undefined)).toBe(false)
  })
})

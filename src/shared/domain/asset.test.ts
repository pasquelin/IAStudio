import { describe, expect, it } from 'vitest'
import {
  assetIdFromUrl,
  assetUrl,
  isAssetType,
  mediaDuration,
  posterUrl,
  withoutSourcePath,
  type Asset,
} from './asset'

const asset = (overrides: Partial<Asset> = {}): Asset => ({
  id: 'asset-1',
  name: 'shot.mp4',
  type: 'video',
  location: 'local',
  tags: [],
  createdAt: '2026-08-07T10:00:00.000Z',
  ...overrides,
})

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

describe('which assets have a picture to show', () => {
  // The renderer is not told where a linked still sits, so a poster that waited for a path
  // would never come — the whole asset browser would fall back to its icons.
  it('offers a poster for a linked still, whose path the window never sees', () => {
    expect(posterUrl(asset({ type: 'image' }))).toBe(assetUrl('asset-1'))
  })

  it('offers one for a still copied into the project too', () => {
    expect(posterUrl(asset({ type: 'image', path: 'assets/img/one.png' }))).not.toBeNull()
  })

  it('offers none for what does not decode as a picture', () => {
    expect(posterUrl(asset({ type: 'video' }))).toBeNull()
    expect(posterUrl(asset({ type: 'audio' }))).toBeNull()
  })

  it('offers none for an asset that only exists in the cloud', () => {
    expect(posterUrl(asset({ type: 'image', location: 'cloud' }))).toBeNull()
  })
})

describe('what the renderer may see of an asset', () => {
  it('drops the absolute path of the file behind it', () => {
    const linked = asset({ sourcePath: '/Volumes/Rushes/A001/rush.mov', hash: 'abc' })
    const seen = withoutSourcePath(linked)

    expect(seen.sourcePath).toBeUndefined()
    // Everything else survives: the window still shows the name, the probe and the hash.
    expect(seen).toEqual({ ...linked, sourcePath: undefined })
  })

  it('leaves an asset with no path of its own untouched', () => {
    const generated = asset({ path: 'assets/vid/one.mp4' })
    expect(withoutSourcePath(generated)).toBe(generated)
  })
})

describe('how long the media runs', () => {
  it('reports what the probe measured', () => {
    expect(mediaDuration(asset({ probe: { duration: 8_000_000, codec: 'h264' } }))).toBe(8_000_000)
  })

  it('calls a still timeless, though its probe says zero', () => {
    const still = asset({ type: 'image', probe: { duration: 0, codec: 'png' } })
    expect(mediaDuration(still)).toBeNull()
  })

  it('calls an unprobed asset timeless too', () => {
    expect(mediaDuration(asset())).toBeNull()
    expect(mediaDuration(null)).toBeNull()
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

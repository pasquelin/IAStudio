import { describe, expect, it } from 'vitest'
import {
  assetBadgeOf,
  assetIdFromUrl,
  assetUrl,
  isAssetType,
  isSyncStatus,
  isTimeless,
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

  /**
   * The whole point of the version: a rewritten asset keeps its id, so without it the browser
   * serves the bitmap it already decoded and an overwrite looks like a gesture that did nothing.
   */
  it('carries a version that a rewrite moves', () => {
    expect(assetUrl('asset_1', '2026-08-12T09:00:00.000Z')).not.toBe(assetUrl('asset_1'))
  })

  // The resolver reads the path, so the id has to survive whatever the query carries.
  it('still names the same asset once versioned', () => {
    expect(assetIdFromUrl(assetUrl('asset/1 2', '2026-08-12T09:00:00.000Z'))).toBe('asset/1 2')
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

  // A tile is what a ⌘S over the asset has to repaint, and the stamp is what tells it to.
  it('stamps the poster with the moment the file last changed', () => {
    const rewritten = asset({ type: 'image', localChangedAt: '2026-08-12T09:00:00.000Z' })

    expect(posterUrl(rewritten)).toBe(assetUrl('asset-1', '2026-08-12T09:00:00.000Z'))
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

  /**
   * The distinction the answer above deliberately loses, and that a trim needs back: a picture
   * has no source to run past, an unprobed rush has one whose length is merely not known yet.
   */
  it('tells a picture from an asset whose length is merely unknown', () => {
    expect(isTimeless(asset({ type: 'image' }))).toBe(true)
    expect(isTimeless(asset({ type: 'texture' }))).toBe(true)
    expect(isTimeless(asset({ type: 'skybox' }))).toBe(true)

    expect(isTimeless(asset({ type: 'video' }))).toBe(false)
    expect(isTimeless(asset({ type: 'audio' }))).toBe(false)
    expect(isTimeless(null)).toBe(false)
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

describe('sync statuses', () => {
  it('accepts the states the catalogue may hold and refuses the rest', () => {
    expect(isSyncStatus('synced')).toBe(true)
    expect(isSyncStatus('local-ahead')).toBe(true)
    expect(isSyncStatus('conflict')).toBe(true)
    expect(isSyncStatus('pushing')).toBe(false)
    expect(isSyncStatus(undefined)).toBe(false)
  })
})

describe('the badge an asset wears', () => {
  const OWNER = 'proj_current'

  it('says local-only when there is no twin', () => {
    expect(assetBadgeOf(asset(), OWNER)).toBe('local-only')
  })

  it('reads the sync status once a twin exists', () => {
    const twin = { remoteAssetId: 'asset_x', remoteOwnerId: OWNER }
    expect(assetBadgeOf(asset({ ...twin, syncStatus: 'synced' }), OWNER)).toBe('synced')
    expect(assetBadgeOf(asset({ ...twin, syncStatus: 'local-ahead' }), OWNER)).toBe('to-push')
    expect(assetBadgeOf(asset({ ...twin, syncStatus: 'remote-ahead' }), OWNER)).toBe('to-pull')
    expect(assetBadgeOf(asset({ ...twin, syncStatus: 'conflict' }), OWNER)).toBe('conflict')
    expect(assetBadgeOf(asset({ ...twin, syncStatus: 'error' }), OWNER)).toBe('error')
  })

  it('reads a twin the catalogue said nothing about as settled', () => {
    // Rows written before the catalogue tracked sync — assets collected from a generation,
    // which were downloaded from the very twin they point at.
    expect(assetBadgeOf(asset({ remoteAssetId: 'asset_x' }), OWNER)).toBe('synced')
  })

  it('says so when the twin belongs to another project', () => {
    // An API key carries its own project: the same identifier means nothing under another key,
    // and calling it synchronised would promise a library that has never heard of it.
    const foreign = asset({
      remoteAssetId: 'asset_x',
      remoteOwnerId: 'proj_other',
      syncStatus: 'synced',
    })
    expect(assetBadgeOf(foreign, OWNER)).toBe('other-account')
  })

  it('judges nothing about ownership while no account is active', () => {
    const twin = asset({
      remoteAssetId: 'asset_x',
      remoteOwnerId: 'proj_other',
      syncStatus: 'synced',
    })
    expect(assetBadgeOf(twin, null)).toBe('synced')
  })
})

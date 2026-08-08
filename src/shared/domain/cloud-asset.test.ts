import { describe, expect, it } from 'vitest'
import { cloudPreviewUrl, type CloudAsset } from './cloud-asset'

function cloudAsset(overrides: Partial<CloudAsset> = {}): CloudAsset {
  return {
    id: 'asset_1',
    name: 'Boulder',
    type: 'image',
    remoteType: 'txt2img',
    ownerId: 'proj_a',
    createdAt: '2026-08-06T10:00:00.000Z',
    updatedAt: '2026-08-06T10:00:00.000Z',
    privacy: 'private',
    tags: [],
    collectionIds: [],
    ...overrides,
  }
}

describe('the picture that stands for a cloud asset', () => {
  const SIGNED = 'https://cdn.cloud.scenario.com/assets/asset_1?Policy=p&Signature=s&Key-Pair-Id=k'
  const THUMB = 'https://cdn.cloud.scenario.com/thumbnails/asset_1'

  it('prefers the thumbnail, which is public and does not expire', () => {
    expect(cloudPreviewUrl(cloudAsset({ thumbnailUrl: THUMB, url: SIGNED }))).toBe(THUMB)
  })

  it('resizes the thumbnail, since the CDN transforms it on the way out', () => {
    expect(cloudPreviewUrl(cloudAsset({ thumbnailUrl: THUMB }), { width: 256, quality: 80 })).toBe(
      `${THUMB}?width=256&quality=80`,
    )
  })

  it('appends to a thumbnail that already carries a query', () => {
    const withQuery = `${THUMB}?format=webp`
    expect(cloudPreviewUrl(cloudAsset({ thumbnailUrl: withQuery }), { width: 128 })).toBe(
      `${withQuery}&width=128`,
    )
  })

  it('never alters the signed URL, which a query string of ours would invalidate', () => {
    // `Policy`, `Signature` and `Key-Pair-Id` sign the request: anything appended answers 403.
    expect(cloudPreviewUrl(cloudAsset({ url: SIGNED }), { width: 256 })).toBe(SIGNED)
  })

  it('answers nothing when there is no picture to show', () => {
    expect(cloudPreviewUrl(cloudAsset())).toBeNull()
  })
})

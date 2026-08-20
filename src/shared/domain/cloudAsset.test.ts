import { describe, expect, it } from 'vitest'
import { cloudPreviewUrl, type CloudAsset } from './cloudAsset'

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

  /**
   * The asset's own file for the kinds that ARE a picture, and it is not a preference of taste:
   * the thumbnail is a small fixed rendition, so a tile wider than it draws it soft. The asset
   * points at `/assets-transform/`, which resizes from the full picture.
   */
  it('draws a picture from the asset itself, which is the one that can be resized', () => {
    expect(cloudPreviewUrl(cloudAsset({ thumbnailUrl: THUMB, url: SIGNED }), 256)).toBe(
      `${SIGNED}&width=256`,
    )
  })

  /**
   * A take's own URL is the sound, a clip's is the film — an `<img>` pointed at either draws
   * nothing at all. Those keep the thumbnail, which is a picture OF the asset rather than it.
   */
  it('keeps the thumbnail for what is not a picture in the first place', () => {
    const clip = cloudAsset({ type: 'video', thumbnailUrl: THUMB, url: SIGNED })

    expect(cloudPreviewUrl(clip, 256)).toBe(`${THUMB}?width=256`)
  })

  it('falls back to the thumbnail when the asset carries no URL of its own', () => {
    expect(cloudPreviewUrl(cloudAsset({ thumbnailUrl: THUMB }), 256)).toBe(`${THUMB}?width=256`)
  })

  it('appends to a URL that already carries a query, as the signed one always does', () => {
    expect(cloudPreviewUrl(cloudAsset({ thumbnailUrl: `${THUMB}?v=2` }), 128)).toBe(
      `${THUMB}?v=2&width=128`,
    )
  })

  it('leaves the URL alone when no width is asked for', () => {
    expect(cloudPreviewUrl(cloudAsset({ url: SIGNED }))).toBe(SIGNED)
  })

  it('answers nothing when there is no picture to show', () => {
    expect(cloudPreviewUrl(cloudAsset())).toBeNull()
  })
})

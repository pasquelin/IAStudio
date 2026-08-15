import { describe, expect, it } from 'vitest'
import type { CloudAsset } from '@shared/domain/cloud-asset'
import { cloudTileFace } from './cloud-tile'

function cloudAsset(overrides: Partial<CloudAsset> = {}): CloudAsset {
  return {
    id: 'cloud_1',
    name: 'boulder.png',
    type: 'image',
    remoteType: 'txt2img',
    ownerId: 'team_1',
    createdAt: '2026-08-08T10:00:00.000Z',
    updatedAt: '2026-08-08T10:00:00.000Z',
    privacy: 'private',
    tags: [],
    collectionIds: [],
    url: 'https://cdn.example/signed.png?X-Amz-Signature=abc',
    thumbnailUrl: 'https://cdn.example/thumb.png',
    generation: { modelId: 'flux_2', modelLabel: 'FLUX.2', prompt: 'a boulder', params: {} },
    ...overrides,
  }
}

describe('what a cloud asset puts on a tile', () => {
  /**
   * The signed URL takes no parameters: appending one invalidates the signature and the CDN
   * answers 403. Three tiles had written that out, and the comment saying why with it.
   */
  it('resizes the public thumbnail rather than the signed asset', () => {
    expect(cloudTileFace(cloudAsset(), 264).url).toBe('https://cdn.example/thumb.png?width=264')
  })

  it('falls back to the signed asset when there is no thumbnail at all', () => {
    const face = cloudTileFace(cloudAsset({ thumbnailUrl: undefined }), 264)

    expect(face.url).toBe('https://cdn.example/signed.png?X-Amz-Signature=abc')
  })

  it('says the model that made it, not the file it was saved under', () => {
    expect(cloudTileFace(cloudAsset(), 264).caption).toBe('FLUX.2')
  })

  it('falls back to the name when nothing generated it', () => {
    expect(cloudTileFace(cloudAsset({ generation: undefined }), 264).caption).toBe('boulder.png')
  })

  /** The glyph of the space the type belongs to, so a tile with no picture still says what it is. */
  it('carries the glyph of the space its type belongs to', () => {
    const picture = cloudTileFace(cloudAsset(), 264)
    const mesh = cloudTileFace(cloudAsset({ type: 'mesh' }), 264)

    expect(picture.fallbackIcon).not.toBe('')
    expect(mesh.fallbackIcon).not.toBe(picture.fallbackIcon)
  })
})

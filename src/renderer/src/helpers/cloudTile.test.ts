import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CloudAsset } from '@shared/domain/cloud-asset'
import { cloudTileFace } from './cloudTile'

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

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('what a cloud asset puts on a tile', () => {
  /**
   * The width a caller passes is the one the tile OCCUPIES, and the density is applied here.
   * Three tiles had written their own factor — a `* 2`, an `880` and nothing at all — and none
   * of the three agreed with the others.
   */
  it('asks for the tile width itself where the display has no density to add', () => {
    expect(cloudTileFace(cloudAsset(), 264).url).toBe(
      'https://cdn.example/signed.png?X-Amz-Signature=abc&width=264',
    )
  })

  it('asks for twice as many pixels on a display that draws twice as many', () => {
    vi.stubGlobal('devicePixelRatio', 2)

    expect(cloudTileFace(cloudAsset(), 264).url).toBe(
      'https://cdn.example/signed.png?X-Amz-Signature=abc&width=528',
    )
  })

  /**
   * A density of 1.5, which Windows scaling reports, would otherwise ask for 396 — a width no
   * other machine shares, and the CDN builds each one it has never seen on first demand.
   */
  it('rounds a fractional density up, so a tile asks for one of two or three widths ever', () => {
    vi.stubGlobal('devicePixelRatio', 1.5)

    expect(cloudTileFace(cloudAsset(), 264).url).toBe(
      'https://cdn.example/signed.png?X-Amz-Signature=abc&width=528',
    )
  })

  /**
   * Measured against the account on 16 August 2026: asking for more than the asset holds does
   * not refuse, it UPSAMPLES — a 1104 px picture answers `width=2208` with a soft 2208 px one,
   * for a megabyte instead of 786 ko. Softness is what a tile shows when nobody sets a ceiling.
   */
  it('never asks for more pixels than the asset holds', () => {
    vi.stubGlobal('devicePixelRatio', 3)

    expect(cloudTileFace(cloudAsset({ width: 512 }), 264).url).toBe(
      'https://cdn.example/signed.png?X-Amz-Signature=abc&width=512',
    )
  })

  it('falls back to the thumbnail when the asset carries no URL of its own', () => {
    const face = cloudTileFace(cloudAsset({ url: undefined }), 264)

    expect(face.url).toBe('https://cdn.example/thumb.png?width=264')
  })

  /**
   * The asset's own name, whether something generated it or not — where this used to answer
   * with the model. A tile of models is a tile where everything of one model reads the same,
   * and the name now derives from the prompt, which says the thing rather than the machine.
   */
  it('says what the asset is called, generated or not', () => {
    expect(cloudTileFace(cloudAsset(), 264).caption).toBe('boulder.png')
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

import { describe, expect, it } from 'vitest'
import type { CloudAsset } from '@shared/domain/cloud-asset'
import { cloudAssetOfHit, cloudAssetOfListing, withPublicThumbnail } from './asset-normalizer'

const LISTING = {
  id: 'asset_1',
  ownerId: 'proj_a',
  createdAt: '2026-08-06T10:00:00.000Z',
  updatedAt: '2026-08-06T11:00:00.000Z',
  kind: 'image',
  mimeType: 'image/png',
  privacy: 'private',
  status: 'success',
  tags: ['hero', 'stone'],
  collectionIds: ['col_1'],
  url: 'https://cdn.cloud.scenario.com/assets/asset_1?Policy=x&Signature=y',
  thumbnail: { assetId: 'asset_t', url: 'https://cdn.cloud.scenario.com/thumbnails/asset_1' },
  metadata: {
    kind: 'image',
    type: 'txt2img',
    prompt: 'mossy boulder',
    modelId: 'model_flux',
    seed: 7,
  },
  properties: { size: 4096, width: 1024, height: 768 },
}

describe('an asset from a listing', () => {
  it('reads the fields a browser needs', () => {
    expect(cloudAssetOfListing(LISTING)).toMatchObject({
      id: 'asset_1',
      type: 'image',
      remoteType: 'txt2img',
      ownerId: 'proj_a',
      privacy: 'private',
      tags: ['hero', 'stone'],
      collectionIds: ['col_1'],
      width: 1024,
      height: 768,
      bytes: 4096,
    })
  })

  it('names a generated asset after its prompt, since the API gives it no name', () => {
    expect(cloudAssetOfListing(LISTING)?.name).toBe('mossy boulder')
  })

  it('prefers the name when the asset carries one', () => {
    const named = { ...LISTING, metadata: { ...LISTING.metadata, name: 'Boulder.png' } }
    expect(cloudAssetOfListing(named)?.name).toBe('Boulder.png')
  })

  it('falls back to the id rather than leaving a cell blank', () => {
    const bare = { ...LISTING, metadata: { kind: 'image', type: 'uploaded' } }
    expect(cloudAssetOfListing(bare)?.name).toBe('asset_1')
  })

  it('carries the generation behind it', () => {
    expect(cloudAssetOfListing(LISTING)?.generation).toMatchObject({
      modelId: 'model_flux',
      prompt: 'mossy boulder',
      seed: 7,
    })
  })

  it('leaves an uploaded file without a generation', () => {
    const uploaded = { ...LISTING, metadata: { kind: 'image', type: 'uploaded' } }
    expect(cloudAssetOfListing(uploaded)?.generation).toBeUndefined()
  })

  it('keeps both URLs apart, since only one of them may be altered', () => {
    const asset = cloudAssetOfListing(LISTING)
    expect(asset?.url).toContain('Signature=y')
    expect(asset?.thumbnailUrl).toBe('https://cdn.cloud.scenario.com/thumbnails/asset_1')
  })

  it('turns away what is data about an asset rather than an asset', () => {
    const caption = { ...LISTING, kind: 'json', metadata: { kind: 'json', type: 'img2txt' } }
    expect(cloudAssetOfListing(caption)).toBeNull()
  })

  it('refuses a record with no identifier rather than inventing one', () => {
    expect(cloudAssetOfListing({ kind: 'image' })).toBeNull()
    expect(cloudAssetOfListing(null)).toBeNull()
    expect(cloudAssetOfListing('asset_1')).toBeNull()
  })

  it('survives a response missing everything optional', () => {
    const bare = { id: 'asset_1', kind: 'image', metadata: { kind: 'image', type: 'uploaded' } }
    expect(cloudAssetOfListing(bare)).toMatchObject({
      id: 'asset_1',
      type: 'image',
      privacy: 'private',
      tags: [],
      collectionIds: [],
    })
  })

  it('reads a skybox as a skybox even though its kind says image', () => {
    const skybox = { ...LISTING, metadata: { kind: 'image', type: 'skybox-base-360' } }
    expect(cloudAssetOfListing(skybox)?.type).toBe('skybox')
  })
})

describe('an asset from a search hit', () => {
  // A hit carries neither `kind` nor `properties` — only `metadata.kind` survives.
  const HIT = {
    id: 'asset_2',
    ownerId: 'proj_a',
    teamId: 'team_a',
    createdAt: '2026-08-06T10:00:00.000Z',
    updatedAt: '2026-08-06T10:00:00.000Z',
    mimeType: 'video/mp4',
    privacy: 'public',
    tags: [],
    collectionIds: [],
    score: 0.82,
    metadata: { kind: 'video', type: 'img2video', width: 1920, height: 1080 },
  }

  it('finds the kind that only survives inside the metadata', () => {
    expect(cloudAssetOfHit(HIT)).toMatchObject({ id: 'asset_2', type: 'video', privacy: 'public' })
  })

  it('falls back to the dimensions the metadata duplicates, since properties is absent', () => {
    expect(cloudAssetOfHit(HIT)).toMatchObject({ width: 1920, height: 1080 })
  })

  it('leaves the size out rather than guessing, since a hit does not report one', () => {
    expect(cloudAssetOfHit(HIT)?.bytes).toBeUndefined()
  })

  it('reads the kind off the mime type when even the metadata has none', () => {
    const sparse = { id: 'asset_3', mimeType: 'audio/wav', metadata: { type: 'uploaded-audio' } }
    expect(cloudAssetOfHit(sparse)?.type).toBe('audio')
  })

  it('fills in the thumbnail the shape omits, whichever errand asked', () => {
    const withUrl = { ...HIT, url: 'https://cdn.example/assets-transform/asset_2?p=100' }
    expect(cloudAssetOfHit(withUrl)?.thumbnailUrl).toBe('https://cdn.example/thumbnails/asset_2')
  })

  it('fills it in for a private asset too, which the CDN serves all the same', () => {
    // `/thumbnails/{id}` answered 200 with a JPEG for a private asset of this account on
    // 9 August 2026, against a 502 for an id that does not exist. Gating this on privacy would
    // cost every private hit its thumbnail for a rule the CDN does not enforce.
    const own = { ...HIT, privacy: 'private', url: 'https://cdn.example/assets-transform/asset_2' }
    expect(cloudAssetOfHit(own)?.thumbnailUrl).toBe('https://cdn.example/thumbnails/asset_2')
  })

  it('turns away a hit it cannot read, rather than deriving a thumbnail for nothing', () => {
    // The search index answers with what the library holds, captioning output included.
    expect(
      cloudAssetOfHit({ id: 'asset_4', metadata: { kind: 'json', type: 'img2txt' } }),
    ).toBeNull()
    expect(cloudAssetOfHit(null)).toBeNull()
  })

  it('leaves a listing alone: it carries its own thumbnail already', () => {
    const listed = cloudAssetOfListing(LISTING)
    expect(listed?.thumbnailUrl).toBe('https://cdn.cloud.scenario.com/thumbnails/asset_1')
  })
})

describe('the thumbnail a search hit does not carry', () => {
  function hit(overrides: Partial<CloudAsset> = {}): CloudAsset {
    return {
      id: 'asset_1',
      name: 'boulder',
      type: 'image',
      remoteType: 'txt2img',
      ownerId: 'team_1',
      createdAt: '2026-08-06T10:00:00.000Z',
      updatedAt: '2026-08-06T10:00:00.000Z',
      privacy: 'public',
      tags: [],
      collectionIds: [],
      ...overrides,
    }
  }

  it('derives it from the CDN the signed URL already names', () => {
    // Never a written-down host: it is the same CDN by construction, and a constant here is one
    // deployment away from being wrong.
    const asset = withPublicThumbnail(hit({ url: 'https://cdn.example/assets-transform/a?p=100' }))
    expect(asset.thumbnailUrl).toBe('https://cdn.example/thumbnails/asset_1')
  })

  it('leaves a thumbnail the API did name alone', () => {
    const named = hit({ url: 'https://cdn.example/a', thumbnailUrl: 'https://cdn.example/t.png' })
    expect(withPublicThumbnail(named).thumbnailUrl).toBe('https://cdn.example/t.png')
  })

  it('has nothing to derive from without a URL', () => {
    expect(withPublicThumbnail(hit()).thumbnailUrl).toBeUndefined()
  })

  it('does not fail a whole page over one unparseable URL', () => {
    // The tile falls back to its glyph; the other thirty-nine still draw.
    expect(withPublicThumbnail(hit({ url: 'not a url' })).thumbnailUrl).toBeUndefined()
  })
})

import { describe, expect, it, vi } from 'vitest'
import type { Asset } from '@shared/domain/asset'

// `protocol.ts` reaches for `protocol` and `net` at call time only, but importing it still pulls
// Electron in — and there is no Electron under Vitest.
vi.mock('electron', () => ({ net: {}, protocol: {} }))

const { createAssetResolvers } = await import('./assetResolvers')
const { ASSET_HOST, POSTER_HOST, THUMB_HOST } = await import('@shared/domain/asset')
const { FAVORITE_HOST } = await import('@shared/domain/favorite')
const { CATALOGUE_CLOSED } = await import('@main/project/catalogClient')
const { NoProjectError } = await import('@main/project/store')

const PROJECT = '/projects/My project.scenario'

const asset = (fields: Partial<Asset>): Asset => ({
  id: 'asset-1',
  name: 'Rush',
  type: 'video',
  location: 'local',
  tags: [],
  createdAt: '2026-08-07T10:00:00.000Z',
  ...fields,
})

const resolversReading = (findAsset: () => Promise<Asset | null>) =>
  createAssetResolvers({
    projectPath: () => PROJECT,
    findAsset,
    favouriteThumbnail: () => '/userData/favorites/favorite_1.png',
    thumbnailOf: () => Promise.resolve(null),
  })

describe('what the asset scheme resolves', () => {
  it('serves the file a row names, and the still beside it, off the same identifier', async () => {
    const resolvers = resolversReading(() =>
      Promise.resolve(asset({ path: 'assets/rush.mp4', posterPath: '.index/posters/a.jpg' })),
    )

    await expect(resolvers[ASSET_HOST]?.('asset-1')).resolves.toBe(`${PROJECT}/assets/rush.mp4`)
    await expect(resolvers[POSTER_HOST]?.('asset-1')).resolves.toBe(
      `${PROJECT}/.index/posters/a.jpg`,
    )
  })

  it('serves nothing while no project is open, without asking the catalogue', async () => {
    const findAsset = vi.fn(() => Promise.resolve(asset({ path: 'assets/rush.mp4' })))
    const resolvers = createAssetResolvers({
      projectPath: () => null,
      findAsset,
      favouriteThumbnail: () => null,
      thumbnailOf: () => Promise.resolve(null),
    })

    await expect(resolvers[ASSET_HOST]?.('asset-1')).resolves.toBeNull()
    expect(findAsset).not.toHaveBeenCalled()
  })

  /**
   * The whole point of the lot this came with: a project left while a grid still asks for its
   * stills is « no file ». Absorbed HERE, since only this side can tell it from a defect —
   * `servedPath` journals whatever reaches it as one.
   */
  it('answers nothing when the project goes while the read is in flight', async () => {
    const closing = resolversReading(() => Promise.reject(new Error(CATALOGUE_CLOSED)))
    const gone = resolversReading(() => Promise.reject(new NoProjectError()))
    // `project.catalog()` throws before any promise exists, which is the shape this must survive.
    const throwing = resolversReading(() => {
      throw new NoProjectError()
    })

    await expect(closing[ASSET_HOST]?.('asset-1')).resolves.toBeNull()
    await expect(gone[POSTER_HOST]?.('asset-1')).resolves.toBeNull()
    await expect(throwing[ASSET_HOST]?.('asset-1')).resolves.toBeNull()
  })

  // What the level in `servedPath` was raised for: a defect must keep travelling, or it is
  // served as a quiet 404 and the journal never says the resolver broke.
  it('lets a defect travel rather than serving it as a missing file', async () => {
    const broken = resolversReading(() => Promise.reject(new TypeError('find is not a function')))

    await expect(broken[ASSET_HOST]?.('asset-1')).rejects.toThrow(TypeError)
  })

  // Kept outside every project, which is why no catalogue can answer for it.
  it('reads a favourite off the folder beside the settings, and a thumbnail off its cache', async () => {
    const resolvers = createAssetResolvers({
      projectPath: () => PROJECT,
      findAsset: () => Promise.resolve(null),
      favouriteThumbnail: () => '/userData/favorites/favorite_1.png',
      thumbnailOf: relative => Promise.resolve(`${PROJECT}/.index/thumbs/${relative}.png`),
    })

    await expect(resolvers[FAVORITE_HOST]?.('favorite_1')).resolves.toBe(
      '/userData/favorites/favorite_1.png',
    )
    await expect(resolvers[THUMB_HOST]?.('folder/file.png')).resolves.toBe(
      `${PROJECT}/.index/thumbs/folder/file.png.png`,
    )
  })
})

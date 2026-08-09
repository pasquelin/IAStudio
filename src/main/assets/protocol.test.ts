import { join, resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { Asset } from '@shared/domain/asset'

// The module reaches for `protocol` and `net` at call time only, but importing it still pulls
// Electron in — and there is no Electron under Vitest.
vi.mock('electron', () => ({ net: {}, protocol: {} }))

const { assetFilePath, servedFileOf, servedPath } = await import('./protocol')
const { ASSET_HOST } = await import('@shared/domain/asset')
const { FAVORITE_HOST } = await import('@shared/domain/favorite')

const asset = (fields: Partial<Asset>): Asset => ({
  id: 'asset-1',
  name: 'Rush',
  type: 'video',
  location: 'local',
  tags: [],
  createdAt: '2026-08-07T10:00:00.000Z',
  ...fields,
})

const PROJECT = resolve('/projects/My project.scenario')

describe('asset file resolution', () => {
  it('resolves a path stored by the catalogue', () => {
    expect(assetFilePath(PROJECT, 'assets/img/asset_1.png')).toBe(
      join(PROJECT, 'assets/img/asset_1.png'),
    )
  })

  // The catalogue is a file in a folder the user can edit: what it holds is not trusted.
  it('refuses a path escaping the project', () => {
    expect(assetFilePath(PROJECT, '../../.ssh/id_rsa')).toBeNull()
    expect(assetFilePath(PROJECT, 'assets/../../secrets/.env')).toBeNull()
  })

  it('refuses an absolute path', () => {
    expect(assetFilePath(PROJECT, '/etc/passwd')).toBeNull()
  })

  it('refuses the project folder itself', () => {
    expect(assetFilePath(PROJECT, '.')).toBeNull()
    expect(assetFilePath(PROJECT, '')).toBeNull()
  })
})

describe('what the scheme serves for an asset', () => {
  it('serves a file the project owns', () => {
    const path = servedFileOf(PROJECT, asset({ path: 'assets/img/asset_1.png' }))
    expect(path).toBe(join(PROJECT, 'assets/img/asset_1.png'))
  })

  it('serves the proxy of a linked rush, which is the point of making one', () => {
    // ProRes is not something WebCodecs decodes: served as is, the monitor would stay black.
    const linked = asset({ sourcePath: '/Volumes/Rushes/a.mov', proxyPath: '.index/proxies/a.mp4' })
    expect(servedFileOf(PROJECT, linked)).toBe(join(PROJECT, '.index/proxies/a.mp4'))
  })

  it('serves a linked file where it lies, since linking is not copying', () => {
    const linked = asset({ sourcePath: '/Volumes/Rushes/a.mov' })
    expect(servedFileOf(PROJECT, linked)).toBe('/Volumes/Rushes/a.mov')
  })

  it('refuses a linked path that is not absolute, which no picker ever returns', () => {
    expect(servedFileOf(PROJECT, asset({ sourcePath: '../../.ssh/id_rsa' }))).toBeNull()
  })

  it('serves nothing for an asset that has no file yet', () => {
    expect(servedFileOf(PROJECT, asset({}))).toBeNull()
  })
})

/**
 * One scheme, two hosts: a row of the open project's catalogue, and a still kept outside every
 * project. Resolved by different means, so the routing has to tell them apart — the wrong
 * resolver would answer 404 on a file that is plainly there.
 */
describe('routing a URL of the scheme', () => {
  const resolveAsset = vi.fn(() => Promise.resolve('/projects/a/assets/img/asset_1.png'))
  const resolveFavorite = vi.fn(() => Promise.resolve('/userData/favorites/favorite_1.png'))
  const resolvers = { [ASSET_HOST]: resolveAsset, [FAVORITE_HOST]: resolveFavorite }

  it('sends an asset to the catalogue and a favourite to the folder beside the settings', async () => {
    await expect(servedPath('scenario://asset/asset_1', resolvers)).resolves.toBe(
      '/projects/a/assets/img/asset_1.png',
    )
    expect(resolveAsset).toHaveBeenCalledWith('asset_1')

    await expect(servedPath('scenario://favorite/favorite_1', resolvers)).resolves.toBe(
      '/userData/favorites/favorite_1.png',
    )
    expect(resolveFavorite).toHaveBeenCalledWith('favorite_1')
  })

  /**
   * A plain object carries `Object.prototype`, so every one of its keys would be a live host —
   * `scenario://toString/x` reached `net.fetch` with a path nobody registered.
   */
  it('serves nothing for a host that is only inherited', async () => {
    await expect(servedPath('scenario://toString/x', resolvers)).resolves.toBeNull()
    await expect(servedPath('scenario://constructor/x', resolvers)).resolves.toBeNull()
    await expect(servedPath('scenario://__proto__/x', resolvers)).resolves.toBeNull()
  })

  it('serves nothing for a host neither resolver knows', async () => {
    await expect(servedPath('scenario://something-else/1', resolvers)).resolves.toBeNull()
    await expect(servedPath('https://example.com/1', resolvers)).resolves.toBeNull()
  })
})

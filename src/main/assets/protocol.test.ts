import { join, resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { Asset } from '@shared/domain/asset'

// The module reaches for `protocol` and `net` at call time only, but importing it still pulls
// Electron in — and there is no Electron under Vitest.
vi.mock('electron', () => ({ net: {}, protocol: {} }))

const { assetFilePath, servedFileOf } = await import('./protocol')

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

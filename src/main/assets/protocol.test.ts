import { join, resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

// The module reaches for `protocol` and `net` at call time only, but importing it still pulls
// Electron in — and there is no Electron under Vitest.
vi.mock('electron', () => ({ net: {}, protocol: {} }))

const { assetFilePath, assetIdFromUrl, assetUrl } = await import('./protocol')

const PROJECT = resolve('/projects/Mon projet.scenario')

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

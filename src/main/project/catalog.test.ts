import { beforeEach, describe, expect, it } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import { createCatalog, migrate, type Catalog } from './catalog'
import { openMemoryDatabase } from './sqlite-memory'
import type { SqliteDriver } from './sqlite'

function asset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 'asset_1',
    name: 'Rocher',
    type: 'image',
    location: 'local',
    tags: [],
    createdAt: '2026-08-06T10:00:00.000Z',
    ...overrides,
  }
}

describe('catalog', () => {
  let driver: SqliteDriver
  let catalog: Catalog

  beforeEach(() => {
    driver = openMemoryDatabase()
    catalog = createCatalog(driver)
  })

  it('reads back everything it stored', () => {
    catalog.add(
      asset({
        path: 'assets/img/asset_1.png',
        remoteAssetId: 'asset_remote',
        jobId: 'job_1',
        width: 1024,
        height: 768,
        bytes: 4096,
        derivedFrom: 'asset_0',
        tags: ['pierre', 'décor'],
      }),
    )

    expect(catalog.find('asset_1')).toEqual({
      id: 'asset_1',
      name: 'Rocher',
      type: 'image',
      location: 'local',
      path: 'assets/img/asset_1.png',
      remoteAssetId: 'asset_remote',
      jobId: 'job_1',
      width: 1024,
      height: 768,
      bytes: 4096,
      derivedFrom: 'asset_0',
      tags: ['décor', 'pierre'],
      createdAt: '2026-08-06T10:00:00.000Z',
    })
  })

  it('answers nothing for an unknown asset', () => {
    expect(catalog.find('asset_missing')).toBeNull()
  })

  it('finds an asset by name, whatever the case', () => {
    catalog.add(asset({ id: 'asset_1', name: 'Rocher mousseux' }))
    catalog.add(asset({ id: 'asset_2', name: 'Ciel' }))

    expect(catalog.search({ text: 'rocher' }).map(found => found.id)).toEqual(['asset_1'])
  })

  it('treats a wildcard typed by the user as a literal character', () => {
    catalog.add(asset({ id: 'asset_1', name: 'Rocher' }))
    catalog.add(asset({ id: 'asset_2', name: '100%' }))

    expect(catalog.search({ text: '%' }).map(found => found.id)).toEqual(['asset_2'])
  })

  it('narrows on every tag at once rather than any of them', () => {
    catalog.add(asset({ id: 'asset_1', tags: ['pierre', 'décor'] }))
    catalog.add(asset({ id: 'asset_2', tags: ['pierre'] }))

    expect(catalog.search({ tags: ['pierre', 'décor'] }).map(found => found.id)).toEqual([
      'asset_1',
    ])
    expect(catalog.search({ tags: ['pierre'] })).toHaveLength(2)
  })

  it('filters by type', () => {
    catalog.add(asset({ id: 'asset_1', type: 'image' }))
    catalog.add(asset({ id: 'asset_2', type: 'mesh' }))

    expect(catalog.search({ type: 'mesh' }).map(found => found.id)).toEqual(['asset_2'])
  })

  it('returns the most recent first, and paginates', () => {
    catalog.add(asset({ id: 'asset_old', createdAt: '2026-08-01T10:00:00.000Z' }))
    catalog.add(asset({ id: 'asset_new', createdAt: '2026-08-06T10:00:00.000Z' }))

    expect(catalog.search({}).map(found => found.id)).toEqual(['asset_new', 'asset_old'])
    expect(catalog.search({ limit: 1 }).map(found => found.id)).toEqual(['asset_new'])
    expect(catalog.search({ limit: 1, offset: 1 }).map(found => found.id)).toEqual(['asset_old'])
  })

  it('replaces an asset instead of duplicating it, tags included', () => {
    catalog.add(asset({ tags: ['brouillon'] }))
    catalog.add(asset({ name: 'Rocher final', tags: ['validé'] }))

    expect(catalog.search({})).toHaveLength(1)
    expect(catalog.find('asset_1')?.tags).toEqual(['validé'])
  })

  it('removes the tags of a deleted asset', () => {
    catalog.add(asset({ tags: ['pierre'] }))
    driver.prepare('DELETE FROM assets WHERE id = ?').run('asset_1')

    expect(driver.prepare('SELECT COUNT(*) AS total FROM asset_tags').get()?.['total']).toBe(0)
  })

  it('migrates once and stays put when replayed', () => {
    const version = (): unknown => driver.prepare('PRAGMA user_version').get()?.['user_version']
    const before = version()

    migrate(driver)
    catalog.add(asset())

    expect(version()).toEqual(before)
    expect(catalog.search({})).toHaveLength(1)
  })
})

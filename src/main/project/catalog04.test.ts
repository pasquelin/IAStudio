import { beforeEach, describe, expect, it, onTestFinished } from 'vitest'

import type { Asset } from '@shared/domain/asset'

import { createCatalog, migrate, type Catalog } from './catalog'

import { openMemoryDatabase } from './sqliteMemory'

import type { SqliteDriver } from './sqlite'

function asset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 'asset_1',
    name: 'Boulder',
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
    onTestFinished(driver.close)
  })

  it('answers with the oldest row when the same bytes were let in twice', () => {
    catalog.add(asset({ id: 'asset_late', hash: 'abc123', createdAt: '2026-08-07T10:00:00.000Z' }))
    catalog.add(asset({ id: 'asset_first', hash: 'abc123', createdAt: '2026-08-01T10:00:00.000Z' }))

    // The row that has been there longest is the one carrying the tags and the proxy.
    expect(catalog.findByHash('abc123')?.id).toBe('asset_first')
  })

  // A child pointing at a parent that is gone reads back as a derivation from nothing.
  it('cuts the derivation of what came from a removed asset', () => {
    catalog.add(asset({ id: 'asset_source' }))
    catalog.add(asset({ id: 'asset_child', derivedFrom: 'asset_source' }))

    catalog.remove('asset_source')

    expect(catalog.find('asset_child')?.derivedFrom).toBeUndefined()
    expect(catalog.find('asset_child')?.id).toBe('asset_child')
  })

  it('removes a row and the tags hanging off it', () => {
    catalog.add(asset({ tags: ['stone', 'rock'] }))
    catalog.remove('asset_1')

    expect(catalog.find('asset_1')).toBeNull()
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

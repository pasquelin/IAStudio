import { beforeEach, describe, expect, it, onTestFinished } from 'vitest'

import type { Asset } from '@shared/domain/asset'

import { createCatalog, type Catalog } from './catalog'

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

/**
 * What the studio ships into a project sits under a dot folder, and the difference between
 * BROWSING and NAMING is the whole of what lets it be hidden and still resolve.
 */
describe('the studio’s own resources, in the catalogue', () => {
  let driver: SqliteDriver
  let catalog: Catalog

  beforeEach(() => {
    driver = openMemoryDatabase()
    catalog = createCatalog(driver)
    onTestFinished(driver.close)

    catalog.add(asset({ id: 'asset_own', name: 'Boulder', path: 'Images/Boulder.png' }))
    catalog.add(
      asset({
        id: 'asset_shipped',
        name: 'GridLarge',
        path: '.resources/Materials/GridLarge.png',
      }),
    )
  })

  it('leaves them out of a listing, which is what every shelf and picker draws', () => {
    expect(catalog.search({}).map(one => one.id)).toEqual(['asset_own'])
  })

  it('leaves them out of the counts the home draws', () => {
    expect(catalog.countByType().image).toBe(1)
  })

  // A row with no path at all is a LIBRARY asset. Reading the predicate without this half drops
  // every cloud asset from the shelf, which no test of the hiding would have shown.
  it('goes on listing a library row, which has no path to be under a dot', () => {
    catalog.add(asset({ id: 'asset_cloud', location: 'cloud', path: undefined }))

    expect(catalog.search({}).map(one => one.id)).toContain('asset_cloud')
  })

  // Named, not browsed: `installBundled` asks by path, an export asks by id, and a scene resolves
  // its texture through `find`. All three must be answered, or a mesh wears a map that is gone.
  it('answers when a caller names one by path, by id, or through find', () => {
    expect(catalog.search({ path: '.resources/Materials/GridLarge.png' })[0]?.id).toBe(
      'asset_shipped',
    )
    expect(catalog.search({ ids: ['asset_shipped'] })[0]?.id).toBe('asset_shipped')
    expect(catalog.find('asset_shipped')?.name).toBe('GridLarge')
  })

  it('hides one under a NESTED dot folder, not only a leading one', () => {
    catalog.add(asset({ id: 'asset_deep', path: 'Modelling/.private/Hidden.png' }))

    expect(catalog.search({}).map(one => one.id)).toEqual(['asset_own'])
  })
})

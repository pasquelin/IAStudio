import { beforeEach, describe, expect, it } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import { createCatalog, migrate, type Catalog } from './catalog'
import { openMemoryDatabase } from './sqlite-memory'
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
  })

  it('keeps the ingest columns through a round trip', () => {
    catalog.add(
      asset({
        id: 'asset_rush',
        name: 'rush.mov',
        type: 'video',
        sourcePath: '/Volumes/Rushes/rush.mov',
        hash: 'abc123',
        probe: { duration: 20_000_000, codec: 'prores', width: 3840, height: 2160, fps: 25 },
        proxyPath: '.index/proxies/abc123.mp4',
        peaksPath: '.index/peaks/abc123.bin',
      }),
    )

    const found = catalog.find('asset_rush')
    expect(found?.sourcePath).toBe('/Volumes/Rushes/rush.mov')
    expect(found?.hash).toBe('abc123')
    expect(found?.probe).toEqual({
      duration: 20_000_000,
      codec: 'prores',
      width: 3840,
      height: 2160,
      fps: 25,
    })
    expect(found?.proxyPath).toBe('.index/proxies/abc123.mp4')
    expect(found?.peaksPath).toBe('.index/peaks/abc123.bin')
  })

  it('leaves the ingest columns absent on an asset that has never been probed', () => {
    catalog.add(asset())
    const found = catalog.find('asset_1')
    expect(found?.hash).toBeUndefined()
    expect(found?.probe).toBeUndefined()
  })

  it('drops a probe that no longer parses rather than failing the whole read', () => {
    catalog.add(asset({ id: 'asset_bad' }))
    driver.prepare('UPDATE assets SET probe = ? WHERE id = ?').run('{ not json', 'asset_bad')
    expect(catalog.find('asset_bad')?.probe).toBeUndefined()
  })

  it('opens a catalogue created before the ingest columns existed', () => {
    // Append-only migrations: a project made yesterday has to open today.
    const older = openMemoryDatabase()
    older.exec(`
      CREATE TABLE assets (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL, location TEXT NOT NULL,
        path TEXT, remote_asset_id TEXT, job_id TEXT, width INTEGER, height INTEGER,
        bytes INTEGER, created_at TEXT NOT NULL, derived_from TEXT
      );
      CREATE TABLE asset_tags (
        asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
        tag TEXT NOT NULL, PRIMARY KEY (asset_id, tag)
      );
      CREATE INDEX assets_type_idx       ON assets(type);
      CREATE INDEX assets_created_at_idx ON assets(created_at DESC);
      CREATE INDEX asset_tags_tag_idx    ON asset_tags(tag);
      PRAGMA user_version = 1;
    `)

    migrate(older)
    const upgraded = createCatalog(older)
    upgraded.add(asset({ id: 'asset_old', hash: 'def456' }))

    expect(upgraded.find('asset_old')?.hash).toBe('def456')
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
        tags: ['stone', 'set-dressing'],
      }),
    )

    expect(catalog.find('asset_1')).toEqual({
      id: 'asset_1',
      name: 'Boulder',
      type: 'image',
      location: 'local',
      path: 'assets/img/asset_1.png',
      remoteAssetId: 'asset_remote',
      jobId: 'job_1',
      width: 1024,
      height: 768,
      bytes: 4096,
      derivedFrom: 'asset_0',
      tags: ['set-dressing', 'stone'],
      createdAt: '2026-08-06T10:00:00.000Z',
    })
  })

  it('answers nothing for an unknown asset', () => {
    expect(catalog.find('asset_missing')).toBeNull()
  })

  it('finds an asset by name, whatever the case', () => {
    catalog.add(asset({ id: 'asset_1', name: 'Mossy boulder' }))
    catalog.add(asset({ id: 'asset_2', name: 'Sky' }))

    expect(catalog.search({ text: 'boulder' }).map(found => found.id)).toEqual(['asset_1'])
  })

  it('treats a wildcard typed by the user as a literal character', () => {
    catalog.add(asset({ id: 'asset_1', name: 'Boulder' }))
    catalog.add(asset({ id: 'asset_2', name: '100%' }))

    expect(catalog.search({ text: '%' }).map(found => found.id)).toEqual(['asset_2'])
  })

  it('narrows on every tag at once rather than any of them', () => {
    catalog.add(asset({ id: 'asset_1', tags: ['stone', 'set-dressing'] }))
    catalog.add(asset({ id: 'asset_2', tags: ['stone'] }))

    expect(catalog.search({ tags: ['stone', 'set-dressing'] }).map(found => found.id)).toEqual([
      'asset_1',
    ])
    expect(catalog.search({ tags: ['stone'] })).toHaveLength(2)
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
    catalog.add(asset({ tags: ['draft'] }))
    catalog.add(asset({ name: 'Final boulder', tags: ['approved'] }))

    expect(catalog.search({})).toHaveLength(1)
    expect(catalog.find('asset_1')?.tags).toEqual(['approved'])
  })

  it('removes the tags of a deleted asset', () => {
    catalog.add(asset({ tags: ['stone'] }))
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

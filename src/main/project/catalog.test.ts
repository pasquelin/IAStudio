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

  // The still of a mesh, which its own file cannot stand in for — see `posterUrl`.
  it('keeps the still recorded beside an asset through a round trip', () => {
    catalog.add(
      asset({ id: 'asset_mesh', type: 'mesh', posterPath: '.index/posters/asset_mesh.jpg' }),
    )

    expect(catalog.find('asset_mesh')?.posterPath).toBe('.index/posters/asset_mesh.jpg')
    expect(catalog.find('asset_mesh')?.type).toBe('mesh')
  })

  it('leaves it absent on an asset nothing wrote one for', () => {
    catalog.add(asset())

    expect(catalog.find('asset_1')?.posterPath).toBeUndefined()
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
    onTestFinished(older.close)
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
    upgraded.add(
      asset({
        id: 'asset_old',
        hash: 'def456',
        map: 'normal',
        posterPath: '.index/posters/asset_old.jpg',
      }),
    )

    expect(upgraded.find('asset_old')?.hash).toBe('def456')
    expect(upgraded.find('asset_old')?.map).toBe('normal')
    // The newest column too: a project opened for the first time on this build is the ordinary
    // case, not the exception, and a migration list read in the wrong order lands exactly here.
    expect(upgraded.find('asset_old')?.posterPath).toBe('.index/posters/asset_old.jpg')
  })

  it('keeps a channel and its reading direction through a round trip', () => {
    catalog.add(asset({ id: 'asset_rough', map: 'roughness', mapInverted: true }))
    catalog.add(asset({ id: 'asset_norm', map: 'normal' }))

    expect(catalog.find('asset_rough')).toMatchObject({ map: 'roughness', mapInverted: true })
    expect(catalog.find('asset_norm')?.map).toBe('normal')
    // Absent rather than false: an ordinary map is not "a map that is not inverted".
    expect(catalog.find('asset_norm')?.mapInverted).toBeUndefined()
  })

  it('leaves a picture that carries no channel alone', () => {
    catalog.add(asset({ id: 'asset_plain' }))
    expect(catalog.find('asset_plain')?.map).toBeUndefined()
  })

  it('finds the local asset an API one became', () => {
    catalog.add(asset({ id: 'asset_local', remoteAssetId: 'remote_1' }))
    expect(catalog.findByRemoteId('remote_1')?.id).toBe('asset_local')
    expect(catalog.findByRemoteId('remote_unknown')).toBeNull()
  })

  // Re-importing the same API asset must not move where its channels point.
  it('answers with the oldest local asset when one was imported twice', () => {
    catalog.add(asset({ id: 'asset_b', remoteAssetId: 'remote_1', createdAt: '2026-08-07T00:00Z' }))
    catalog.add(asset({ id: 'asset_a', remoteAssetId: 'remote_1', createdAt: '2026-08-06T00:00Z' }))

    expect(catalog.findByRemoteId('remote_1')?.id).toBe('asset_a')
  })

  // The column is a free string, and a catalogue outlives the build that wrote it.
  it('ignores a channel this build no longer knows rather than failing the read', () => {
    catalog.add(asset({ id: 'asset_odd', map: 'normal' }))
    driver.prepare('UPDATE assets SET map = ? WHERE id = ?').run('cavity', 'asset_odd')

    const found = catalog.find('asset_odd')
    expect(found?.map).toBeUndefined()
    expect(found?.id).toBe('asset_odd')
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

  // The emoji is the case: `find` and the page path used to order tags by two rules that agree
  // over the whole BMP and part ways above it, so any tag staying inside it — accents included —
  // hid the split. See `catalog.ts`.
  it('answers one order for the tags of an asset, read alone or through a page', () => {
    catalog.add(asset({ id: 'asset_1', tags: ['Zoom', 'Éclairage', 'ﬀusion', '🌟etoile'] }))

    const alone = catalog.find('asset_1')?.tags
    const [inPage] = catalog.search({})

    expect(alone).toEqual(inPage?.tags)
    expect(alone).toEqual(['Zoom', 'Éclairage', '🌟etoile', 'ﬀusion'])
  })

  it('finds an asset by name, whatever the case', () => {
    catalog.add(asset({ id: 'asset_1', name: 'Mossy boulder' }))
    catalog.add(asset({ id: 'asset_2', name: 'Sky' }))

    expect(catalog.search({ text: 'boulder' }).map(found => found.id)).toEqual(['asset_1'])
  })

  /**
   * A renamed asset must not answer to the name it no longer has. The full-text index is an
   * external-content fts5 table kept by three triggers, and a row written over does not fire the
   * DELETE one unless `recursive_triggers` is on — so the old name stayed indexed under a rowid
   * the write had just freed, and searching for it found the asset under its new name.
   */
  it('stops answering to the name an asset no longer has', () => {
    catalog.add(asset({ id: 'asset_1', name: 'Mossy boulder' }))
    catalog.add(asset({ id: 'asset_1', name: 'Rocher moussu' }))

    expect(catalog.search({ text: 'boulder' })).toEqual([])
    expect(catalog.search({ text: 'moussu' }).map(found => found.id)).toEqual(['asset_1'])
  })

  it('treats a wildcard typed by the user as a literal character', () => {
    catalog.add(asset({ id: 'asset_1', name: 'Boulder' }))
    catalog.add(asset({ id: 'asset_2', name: '100%' }))

    expect(catalog.search({ text: '%' }).map(found => found.id)).toEqual(['asset_2'])
  })

  /**
   * The search runs on every keystroke, so a word half typed has to find its row — that is what
   * the trailing star of the fts5 expression is for.
   */
  it('finds a word still being typed', () => {
    catalog.add(asset({ id: 'asset_1', name: 'Mossy boulder' }))
    catalog.add(asset({ id: 'asset_2', name: 'Sky' }))

    expect(catalog.search({ text: 'mos' }).map(found => found.id)).toEqual(['asset_1'])
  })

  /** Filters narrow: two words are two conditions, not two chances. */
  it('asks for every word, not any of them', () => {
    catalog.add(asset({ id: 'asset_1', name: 'Mossy boulder' }))
    catalog.add(asset({ id: 'asset_2', name: 'Mossy sky' }))

    expect(catalog.search({ text: 'mossy boulder' }).map(found => found.id)).toEqual(['asset_1'])
  })

  /** Typed in a hurry, without the accent the name carries. */
  it('folds the accents away on both sides', () => {
    catalog.add(asset({ id: 'asset_1', name: 'Pierre moussée' }))

    expect(catalog.search({ text: 'moussee' }).map(found => found.id)).toEqual(['asset_1'])
  })

  /**
   * The words are indexed in a table of their own, and nothing keeps it true but the triggers.
   * Without them a deleted asset stays findable — a row the studio would then fail to open.
   */
  it('forgets the words of an asset that is gone', () => {
    catalog.add(asset({ id: 'asset_1', name: 'Mossy boulder' }))
    catalog.remove('asset_1')

    expect(catalog.search({ text: 'mossy' })).toEqual([])
  })

  /**
   * SQLite hands a freed rowid back out: delete the only asset and the next one takes its place
   * in the table. The words of the first are keyed on that number — left behind, they answer for
   * the second, and searching "mossy" returns an asset called "Dry sky".
   */
  it('does not let the words of a deleted asset answer for the one that takes its place', () => {
    catalog.add(asset({ id: 'asset_1', name: 'Mossy boulder' }))
    catalog.remove('asset_1')
    catalog.add(asset({ id: 'asset_2', name: 'Dry sky' }))

    expect(catalog.search({ text: 'mossy' })).toEqual([])
    expect(catalog.search({ text: 'dry' }).map(found => found.id)).toEqual(['asset_2'])
  })

  it('forgets the name an asset used to carry', () => {
    catalog.add(asset({ id: 'asset_1', name: 'Mossy boulder' }))
    catalog.add(asset({ id: 'asset_1', name: 'Dry boulder' }))

    expect(catalog.search({ text: 'mossy' })).toEqual([])
    expect(catalog.search({ text: 'dry' }).map(found => found.id)).toEqual(['asset_1'])
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

  /**
   * What the explorer asks before it hands a file to the system: the folder shows a file name,
   * and only the catalogue can say whether that file is an asset this studio edits.
   */
  it('finds the asset filed at a path, and nothing else', () => {
    catalog.add(asset({ id: 'asset_1', path: 'assets/img/asset_1.png' }))
    catalog.add(asset({ id: 'asset_2', path: 'assets/img/asset_2.png' }))

    const found = catalog.search({ path: 'assets/img/asset_2.png' })
    expect(found.map(one => one.id)).toEqual(['asset_2'])
  })

  /**
   * The same question for a whole listing, in one round trip: a browser showing four hundred
   * files asked four hundred times, and each answer is a query against this database.
   */
  it('answers for a whole listing of paths at once', () => {
    catalog.add(asset({ id: 'asset_1', path: 'Repérages/ruelle.png' }))
    catalog.add(asset({ id: 'asset_2', path: 'Repérages/toit.png' }))
    catalog.add(asset({ id: 'asset_3', path: 'ailleurs/rien.png' }))

    const found = catalog.search({ paths: ['Repérages/ruelle.png', 'Repérages/toit.png'] })
    expect(found.map(one => one.id).sort()).toEqual(['asset_1', 'asset_2'])
  })

  // As `types` does, and for the same reason: a caller with nothing to ask about asks nothing,
  // where an empty list read as « no filter » would answer with the whole catalogue.
  it('answers nothing at all for an empty listing', () => {
    catalog.add(asset({ id: 'asset_1', path: 'Repérages/ruelle.png' }))

    expect(catalog.search({ paths: [] })).toEqual([])
  })

  // Exact, never a prefix: the question is « is THIS file an asset », and a folder that shares
  // the opening of a file name is not the file.
  it('answers nothing for a path no asset was filed at', () => {
    catalog.add(asset({ id: 'asset_1', path: 'assets/img/asset_1.png' }))

    expect(catalog.search({ path: 'assets/img' })).toEqual([])
    expect(catalog.search({ path: 'assets/img/stray.png' })).toEqual([])
  })

  describe('following a file that moved', () => {
    const pathOf = (id: string): string | undefined => catalog.find(id)?.path

    it('refiles a folder and everything under it, keeping every id', () => {
      catalog.add(asset({ id: 'asset_1', path: 'Rushes/A001.mov' }))
      catalog.add(asset({ id: 'asset_2', path: 'Rushes/day two/A002.mov' }))
      catalog.add(asset({ id: 'asset_3', path: 'Stills/A003.png' }))

      catalog.repath('Rushes', 'Footage/Raw')

      expect(pathOf('asset_1')).toBe('Footage/Raw/A001.mov')
      expect(pathOf('asset_2')).toBe('Footage/Raw/day two/A002.mov')
      expect(pathOf('asset_3')).toBe('Stills/A003.png')
    })

    // What makes a replayed move journal safe: the second pass finds nothing where the first
    // one already moved everything.
    it('writes nothing the second time, and nothing for a path no row is at', () => {
      catalog.add(asset({ id: 'asset_1', path: 'Rushes/A001.mov' }))

      catalog.repath('Rushes', 'Footage')
      catalog.repath('Rushes', 'Elsewhere')
      catalog.repath('Nowhere', 'Somewhere')

      expect(pathOf('asset_1')).toBe('Footage/A001.mov')
    })

    /**
     * Rewriting `Rushes` to `Rushes/2024` leaves rows that still begin with `Rushes/`, so a
     * second pass would file them at `Rushes/2024/2024/…` — and a journal replayed at every
     * opening sinks them one level deeper each time.
     */
    it('refuses to move a folder into itself, which would never settle', () => {
      catalog.add(asset({ id: 'asset_1', path: 'Rushes/A001.mov' }))

      catalog.repath('Rushes', 'Rushes/2024')

      expect(pathOf('asset_1')).toBe('Rushes/A001.mov')
    })

    // One folder to the filesystem, two strings to SQLite. Left as typed, this moved nothing at
    // all — silently, and after the files had already gone.
    it('reads a trailing slash as the same folder', () => {
      catalog.add(asset({ id: 'asset_1', path: 'Rushes/A001.mov' }))

      catalog.repath('Rushes/', 'Footage')

      expect(pathOf('asset_1')).toBe('Footage/A001.mov')
    })

    // `LIKE` is case-insensitive over ASCII in SQLite, and would have carried this one along.
    it('leaves a folder whose name differs only in case', () => {
      catalog.add(asset({ id: 'asset_1', path: 'Rushes/A001.mov' }))
      catalog.add(asset({ id: 'asset_2', path: 'RUSHES/A002.mov' }))

      catalog.repath('Rushes', 'Footage')

      expect(pathOf('asset_1')).toBe('Footage/A001.mov')
      expect(pathOf('asset_2')).toBe('RUSHES/A002.mov')
    })

    // `LIKE` would have read these as wildcards and swept in paths having nothing to do with
    // the folder that moved.
    it('is not fooled by a folder whose name holds a wildcard character', () => {
      catalog.add(asset({ id: 'asset_1', path: '100%_final/A001.mov' }))
      catalog.add(asset({ id: 'asset_2', path: '100Xdone/A002.mov' }))

      catalog.repath('100%_final', 'Done')

      expect(pathOf('asset_1')).toBe('Done/A001.mov')
      expect(pathOf('asset_2')).toBe('100Xdone/A002.mov')
    })

    // SQLite counts characters where JavaScript counts UTF-16 units: a length measured on the
    // wrong side cuts one unit too far and rewrites every path under it wrong.
    it('cuts a folder named with an emoji at the right place', () => {
      catalog.add(asset({ id: 'asset_1', path: '🎬 Rushes/A001.mov' }))

      catalog.repath('🎬 Rushes', 'Footage')

      expect(pathOf('asset_1')).toBe('Footage/A001.mov')
    })

    /**
     * The trash is reversible, so the row is DATED and not dropped: a file the user takes back
     * out is found where the catalogue still says it is, and the next pass clears the date. A
     * row deleted the moment the file went to the trash would leave a restored file with no
     * prompt, no seed and no lineage — the one copy of all three.
     */
    it('dates a trashed folder and every row beneath it, and says how many it touched', () => {
      catalog.add(asset({ id: 'asset_1', path: 'Rushes/A001.mov' }))
      catalog.add(asset({ id: 'asset_2', path: 'Rushes/day two/A002.mov' }))
      catalog.add(asset({ id: 'asset_3', path: 'Rushesque/A003.mov' }))

      expect(catalog.forgetUnder('Rushes/')).toBe(2)

      // Gone from every listing, and still there.
      expect(catalog.search({})).toEqual([expect.objectContaining({ id: 'asset_3' })])
      expect(catalog.find('asset_1')).not.toBeNull()
      expect(catalog.filed().find(row => row.path === 'Rushes/A001.mov')?.missingAt).not.toBeNull()
      expect(pathOf('asset_3')).toBe('Rushesque/A003.mov')
    })

    // Run twice over the same state, the second pass has nothing to say — which is what lets the
    // handler use the count to decide whether a window has any reason to reload.
    it('says nothing the second time about a folder already dated', () => {
      catalog.add(asset({ id: 'asset_1', path: 'Rushes/A001.mov' }))

      expect(catalog.forgetUnder('Rushes')).toBe(1)
      expect(catalog.forgetUnder('Rushes')).toBe(0)
    })

    // What tells the handler whether any window has a reason to reload.
    it('says nothing went for a path the catalogue never knew', () => {
      expect(catalog.forgetUnder('Notes')).toBe(0)
    })
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

  it('finds a row by the bytes it holds, which is what a second import matches on', () => {
    catalog.add(asset({ id: 'asset_rush', hash: 'abc123' }))

    expect(catalog.findByHash('abc123')?.id).toBe('asset_rush')
    expect(catalog.findByHash('other')).toBeNull()
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

describe('catalogue provenance and sync', () => {
  let driver: SqliteDriver
  let catalog: Catalog

  beforeEach(() => {
    driver = openMemoryDatabase()
    catalog = createCatalog(driver)
    onTestFinished(driver.close)
  })

  it('keeps a generation through a round trip', () => {
    const generation = {
      modelId: 'model_flux',
      modelLabel: 'Flux 1.1 Pro',
      prompt: 'mossy boulder, overcast',
      params: { guidance: 3.5, scheduler: 'euler' },
      seed: 42,
    }
    catalog.add(asset({ generation }))

    expect(catalog.find('asset_1')?.generation).toEqual(generation)
  })

  it('leaves an imported file without a generation rather than an empty one', () => {
    catalog.add(asset())
    expect(catalog.find('asset_1')?.generation).toBeUndefined()
  })

  it('keeps a generation whose seed the model never reported', () => {
    catalog.add(asset({ generation: { modelId: 'm', modelLabel: 'M', prompt: 'p', params: {} } }))

    const found = catalog.find('asset_1')?.generation
    expect(found).toEqual({ modelId: 'm', modelLabel: 'M', prompt: 'p', params: {} })
    expect(found && 'seed' in found).toBe(false)
  })

  it('keeps the twin and its three stamps through a round trip', () => {
    const twin: Partial<Asset> = {
      remoteAssetId: 'asset_remote',
      remoteOwnerId: 'proj_a',
      remoteUpdatedAt: '2026-08-06T09:00:00.000Z',
      remoteSyncedAt: '2026-08-06T09:30:00.000Z',
      localChangedAt: '2026-08-06T10:00:00.000Z',
      syncStatus: 'local-ahead',
      syncError: 'upload-too-large',
    }
    catalog.add(asset(twin))

    expect(catalog.find('asset_1')).toMatchObject(twin)
  })

  it('drops a sync state this build no longer knows rather than carrying it out of the union', () => {
    catalog.add(asset({ syncStatus: 'synced' }))
    // Written straight to the column, as a build that knew a seventh state would have left it.
    driver.prepare("UPDATE assets SET sync_state = 'quarantined' WHERE id = ?").run('asset_1')

    expect(catalog.find('asset_1')?.syncStatus).toBeUndefined()
  })

  it('reads the members of one generation in the order the API produced them', () => {
    for (const [index, name] of ['albedo', 'normal', 'height'].entries()) {
      catalog.add(
        asset({
          id: `asset_${index}`,
          name,
          type: 'texture',
          groupId: 'job_1',
          outputIndex: 2 - index,
          createdAt: `2026-08-06T10:0${index}:00.000Z`,
        }),
      )
    }

    expect(catalog.search({ groupId: 'job_1' }).map(found => found.name)).toEqual([
      'height',
      'normal',
      'albedo',
    ])
  })

  it('narrows to the kinds a workspace accepts', () => {
    catalog.add(asset({ id: 'a', type: 'image' }))
    catalog.add(asset({ id: 'b', type: 'audio' }))
    catalog.add(asset({ id: 'c', type: 'texture' }))

    const found = catalog.search({ types: ['image', 'texture'] })
    expect(found.map(one => one.id).sort()).toEqual(['a', 'c'])
  })

  it('shows nothing for a workspace that accepts nothing', () => {
    // An empty list is "nothing", not "no filter" — otherwise it would show everything.
    catalog.add(asset())
    expect(catalog.search({ types: [] })).toEqual([])
  })

  it('narrows by where the bytes are and by what is still to move', () => {
    catalog.add(asset({ id: 'a', location: 'local', syncStatus: 'local-ahead' }))
    catalog.add(asset({ id: 'b', location: 'cloud', syncStatus: 'synced' }))

    expect(catalog.search({ location: 'cloud' }).map(one => one.id)).toEqual(['b'])
    expect(catalog.search({ syncStatus: 'local-ahead' }).map(one => one.id)).toEqual(['a'])
  })

  it('counts every kind, zeroes included', () => {
    catalog.add(asset({ id: 'a', type: 'image' }))
    catalog.add(asset({ id: 'b', type: 'image' }))
    catalog.add(asset({ id: 'c', type: 'skybox' }))

    expect(catalog.countByType()).toEqual({
      image: 2,
      video: 0,
      audio: 0,
      mesh: 0,
      texture: 0,
      skybox: 1,
    })
  })

  // The column is a free string in SQLite, as everywhere else here: a row written by a build
  // that knew a seventh kind must not be counted under one of the six this one knows.
  it('leaves a kind this build no longer knows out of the totals', () => {
    catalog.add(asset({ id: 'a', type: 'image' }))
    driver.exec(`
      INSERT INTO assets (id, name, type, location, created_at)
      VALUES ('b', 'hologram', 'hologram', 'local', '2026-08-08T10:00:00.000Z')
    `)

    expect(catalog.countByType()).toMatchObject({ image: 1 })
  })

  it('narrows to what a model produced, leaving imports out', () => {
    catalog.add(
      asset({
        id: 'made',
        generation: { modelId: 'flux', modelLabel: 'FLUX', prompt: 'a boulder', params: {} },
      }),
    )
    catalog.add(asset({ id: 'imported' }))

    expect(catalog.search({ generated: true }).map(one => one.id)).toEqual(['made'])
  })

  it('searches the prompt as well as the name', () => {
    catalog.add(
      asset({
        id: 'a',
        name: 'Flux 1',
        generation: { modelId: 'm', modelLabel: 'M', prompt: 'mossy boulder', params: {} },
      }),
    )
    catalog.add(asset({ id: 'b', name: 'mossy rock' }))

    expect(
      catalog
        .search({ text: 'mossy' })
        .map(one => one.id)
        .sort(),
    ).toEqual(['a', 'b'])
  })
})

describe('migrating a catalogue that already holds assets', () => {
  it('carries the existing rows across without losing a field', () => {
    const older = openMemoryDatabase()
    onTestFinished(older.close)
    older.exec(`
      CREATE TABLE assets (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL, location TEXT NOT NULL,
        path TEXT, remote_asset_id TEXT, job_id TEXT, width INTEGER, height INTEGER,
        bytes INTEGER, created_at TEXT NOT NULL, derived_from TEXT,
        source_path TEXT, hash TEXT, probe TEXT, proxy_path TEXT, peaks_path TEXT,
        map TEXT, map_inverted INTEGER
      );
      CREATE TABLE asset_tags (
        asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
        tag TEXT NOT NULL, PRIMARY KEY (asset_id, tag)
      );
      INSERT INTO assets (id, name, type, location, path, remote_asset_id, created_at, hash)
        VALUES ('asset_old', 'Boulder', 'image', 'local', 'assets/img/asset_old.png',
                'asset_remote', '2026-08-01T10:00:00.000Z', 'abc123');
      INSERT INTO asset_tags (asset_id, tag) VALUES ('asset_old', 'hero');
      PRAGMA user_version = 3;
    `)

    migrate(older)
    const upgraded = createCatalog(older)
    const found = upgraded.find('asset_old')

    expect(found).toMatchObject({
      id: 'asset_old',
      name: 'Boulder',
      path: 'assets/img/asset_old.png',
      remoteAssetId: 'asset_remote',
      hash: 'abc123',
      tags: ['hero'],
    })
    // Nothing invented for a row that predates the columns: an asset the catalogue never
    // tracked has no provenance, and claiming one would put a prompt on an imported file.
    expect(found?.generation).toBeUndefined()
    expect(found?.syncStatus).toBeUndefined()
    expect(found?.groupId).toBeUndefined()
  })

  /**
   * The words of a project that predates the index. A migration that only started indexing from
   * its next import would leave a library of two thousand assets unsearchable, and nothing on
   * screen would say why.
   */
  it('makes what was already there searchable at once', () => {
    const older = openMemoryDatabase()
    onTestFinished(older.close)
    older.exec(`
      CREATE TABLE assets (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL, location TEXT NOT NULL,
        path TEXT, remote_asset_id TEXT, job_id TEXT, width INTEGER, height INTEGER,
        bytes INTEGER, created_at TEXT NOT NULL, derived_from TEXT,
        source_path TEXT, hash TEXT, probe TEXT, proxy_path TEXT, peaks_path TEXT,
        map TEXT, map_inverted INTEGER
      );
      CREATE TABLE asset_tags (
        asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
        tag TEXT NOT NULL, PRIMARY KEY (asset_id, tag)
      );
      INSERT INTO assets (id, name, type, location, created_at)
        VALUES ('asset_old', 'Mossy boulder', 'image', 'local', '2026-08-01T10:00:00.000Z');
      PRAGMA user_version = 3;
    `)

    migrate(older)

    expect(
      createCatalog(older)
        .search({ text: 'mossy' })
        .map(found => found.id),
    ).toEqual(['asset_old'])
  })
})

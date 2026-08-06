import type { Asset, AssetQuery, AssetType } from '@shared/domain/asset'
import type { SqliteDriver, SqlRow, SqlValue } from './sqlite'

/**
 * Schema history. Append only: an existing project carries its version in `user_version`, and
 * rewriting a past entry would leave already-created catalogues on a schema nobody describes.
 */
const MIGRATIONS: readonly string[] = [
  `
  CREATE TABLE assets (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    type            TEXT NOT NULL,
    location        TEXT NOT NULL,
    path            TEXT,
    remote_asset_id TEXT,
    job_id          TEXT,
    width           INTEGER,
    height          INTEGER,
    bytes           INTEGER,
    created_at      TEXT NOT NULL,
    derived_from    TEXT
  );

  CREATE TABLE asset_tags (
    asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    tag      TEXT NOT NULL,
    PRIMARY KEY (asset_id, tag)
  );

  CREATE INDEX assets_type_idx       ON assets(type);
  CREATE INDEX assets_created_at_idx ON assets(created_at DESC);
  CREATE INDEX asset_tags_tag_idx    ON asset_tags(tag);
  `,
]

const DEFAULT_LIMIT = 200

function currentVersion(driver: SqliteDriver): number {
  const row = driver.prepare('PRAGMA user_version').get()
  const value = row?.['user_version']
  return typeof value === 'bigint' ? Number(value) : typeof value === 'number' ? value : 0
}

export function migrate(driver: SqliteDriver): void {
  for (let version = currentVersion(driver); version < MIGRATIONS.length; version++) {
    driver.exec(MIGRATIONS[version] ?? '')
    driver.exec(`PRAGMA user_version = ${version + 1}`)
  }
}

function text(row: SqlRow, column: string): string {
  const value = row[column]
  return typeof value === 'string' ? value : ''
}

function optionalText(row: SqlRow, column: string): string | undefined {
  const value = row[column]
  return typeof value === 'string' ? value : undefined
}

function optionalNumber(row: SqlRow, column: string): number | undefined {
  const value = row[column]
  if (typeof value === 'number') return value
  return typeof value === 'bigint' ? Number(value) : undefined
}

/** The column is a closed union in the domain but a free string in SQLite. */
function assetType(row: SqlRow): AssetType {
  const value = text(row, 'type')
  const known: readonly AssetType[] = ['image', 'video', 'audio', 'mesh', 'texture', 'skybox']
  return known.find(candidate => candidate === value) ?? 'image'
}

function assetOf(row: SqlRow, tags: string[]): Asset {
  const asset: Asset = {
    id: text(row, 'id'),
    name: text(row, 'name'),
    type: assetType(row),
    location: text(row, 'location') === 'cloud' ? 'cloud' : 'local',
    tags,
    createdAt: text(row, 'created_at'),
  }

  const path = optionalText(row, 'path')
  const remoteAssetId = optionalText(row, 'remote_asset_id')
  const jobId = optionalText(row, 'job_id')
  const derivedFrom = optionalText(row, 'derived_from')
  const width = optionalNumber(row, 'width')
  const height = optionalNumber(row, 'height')
  const bytes = optionalNumber(row, 'bytes')

  if (path !== undefined) asset.path = path
  if (remoteAssetId !== undefined) asset.remoteAssetId = remoteAssetId
  if (jobId !== undefined) asset.jobId = jobId
  if (derivedFrom !== undefined) asset.derivedFrom = derivedFrom
  if (width !== undefined) asset.width = width
  if (height !== undefined) asset.height = height
  if (bytes !== undefined) asset.bytes = bytes

  return asset
}

/** `%` and `_` are wildcards: typed by a user they must match themselves, not everything. */
function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, character => `\\${character}`)
}

export type Catalog = {
  add: (asset: Asset) => Asset
  find: (assetId: string) => Asset | null
  search: (query: AssetQuery) => Asset[]
  close: () => void
}

export function createCatalog(driver: SqliteDriver): Catalog {
  migrate(driver)

  const insertAsset = driver.prepare(`
    INSERT OR REPLACE INTO assets
      (id, name, type, location, path, remote_asset_id, job_id, width, height, bytes,
       created_at, derived_from)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const deleteTags = driver.prepare('DELETE FROM asset_tags WHERE asset_id = ?')
  const insertTag = driver.prepare('INSERT OR IGNORE INTO asset_tags (asset_id, tag) VALUES (?, ?)')
  const selectTags = driver.prepare('SELECT tag FROM asset_tags WHERE asset_id = ? ORDER BY tag')
  const selectAsset = driver.prepare('SELECT * FROM assets WHERE id = ?')

  const tagsOf = (assetId: string): string[] => selectTags.all(assetId).map(row => text(row, 'tag'))

  return {
    add: asset => {
      insertAsset.run(
        asset.id,
        asset.name,
        asset.type,
        asset.location,
        asset.path ?? null,
        asset.remoteAssetId ?? null,
        asset.jobId ?? null,
        asset.width ?? null,
        asset.height ?? null,
        asset.bytes ?? null,
        asset.createdAt,
        asset.derivedFrom ?? null,
      )

      deleteTags.run(asset.id)
      for (const tag of asset.tags) insertTag.run(asset.id, tag)

      return asset
    },

    find: assetId => {
      const row = selectAsset.get(assetId)
      return row ? assetOf(row, tagsOf(assetId)) : null
    },

    search: query => {
      const conditions: string[] = []
      const params: SqlValue[] = []

      if (query.type) {
        conditions.push('type = ?')
        params.push(query.type)
      }

      if (query.text) {
        conditions.push("name LIKE ? ESCAPE '\\'")
        params.push(`%${escapeLike(query.text)}%`)
      }

      // Every tag must match, not any: filters narrow, they do not widen.
      if (query.tags?.length) {
        const placeholders = query.tags.map(() => '?').join(', ')
        conditions.push(`id IN (
          SELECT asset_id FROM asset_tags WHERE tag IN (${placeholders})
          GROUP BY asset_id HAVING COUNT(DISTINCT tag) = ?
        )`)
        params.push(...query.tags, query.tags.length)
      }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
      params.push(query.limit ?? DEFAULT_LIMIT, query.offset ?? 0)

      const rows = driver
        .prepare(`SELECT * FROM assets ${where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`)
        .all(...params)

      return rows.map(row => assetOf(row, tagsOf(text(row, 'id'))))
    },

    close: () => driver.close(),
  }
}

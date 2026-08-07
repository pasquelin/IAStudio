import { isRecord } from '@shared/guards'
import {
  isAssetType,
  mediaProbeOf,
  probeNumber,
  type Asset,
  type AssetQuery,
  type AssetType,
  type MediaProbe,
} from '@shared/domain/asset'
import { isPbrChannel } from '@shared/domain/texture'
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
  `
  ALTER TABLE assets ADD COLUMN source_path TEXT;
  ALTER TABLE assets ADD COLUMN hash        TEXT;
  ALTER TABLE assets ADD COLUMN probe       TEXT;
  ALTER TABLE assets ADD COLUMN proxy_path  TEXT;
  ALTER TABLE assets ADD COLUMN peaks_path  TEXT;

  CREATE INDEX assets_hash_idx ON assets(hash);
  `,
  `
  ALTER TABLE assets ADD COLUMN map          TEXT;
  ALTER TABLE assets ADD COLUMN map_inverted INTEGER;

  -- The channels of one texture are read together, from the asset they derive from.
  CREATE INDEX assets_derived_from_idx ON assets(derived_from);
  -- Resolving an API parent to the local asset it became, when a generation reports one.
  CREATE INDEX assets_remote_asset_id_idx ON assets(remote_asset_id);
  `,
]

const DEFAULT_LIMIT = 200

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

function currentVersion(driver: SqliteDriver): number {
  const row = driver.prepare('PRAGMA user_version').get()
  return row ? (optionalNumber(row, 'user_version') ?? 0) : 0
}

/** The column is a closed union in the domain but a free string in SQLite. */
function assetType(row: SqlRow): AssetType {
  const value = text(row, 'type')
  return isAssetType(value) ? value : 'image'
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

  const sourcePath = optionalText(row, 'source_path')
  const hash = optionalText(row, 'hash')
  const probe = parseProbe(optionalText(row, 'probe'))
  const proxyPath = optionalText(row, 'proxy_path')
  const peaksPath = optionalText(row, 'peaks_path')
  const map = optionalText(row, 'map')

  if (sourcePath !== undefined) asset.sourcePath = sourcePath
  if (hash !== undefined) asset.hash = hash
  if (probe !== undefined) asset.probe = probe
  if (proxyPath !== undefined) asset.proxyPath = proxyPath
  if (peaksPath !== undefined) asset.peaksPath = peaksPath

  // The column is a free string in SQLite; a channel this build no longer knows leaves the
  // asset as an ordinary picture rather than making the whole row unreadable.
  if (isPbrChannel(map)) {
    asset.map = map
    if (optionalNumber(row, 'map_inverted') === 1) asset.mapInverted = true
  }

  return asset
}

/**
 * The probe is stored as JSON: it is read whole, never filtered on, and giving each of its
 * seven fields a column would mean a migration every time a codec exposes one more.
 */
function parseProbe(raw: string | undefined): MediaProbe | undefined {
  if (raw === undefined) return undefined

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return undefined

    return (
      mediaProbeOf({
        duration: probeNumber(parsed.duration),
        codec: typeof parsed.codec === 'string' ? parsed.codec : undefined,
        width: probeNumber(parsed.width),
        height: probeNumber(parsed.height),
        fps: probeNumber(parsed.fps),
        sampleRate: probeNumber(parsed.sampleRate),
        channels: probeNumber(parsed.channels),
      }) ?? undefined
    )
  } catch {
    return undefined
  }
}

/** `%` and `_` are wildcards: typed by a user they must match themselves, not everything. */
function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, character => `\\${character}`)
}

export type Catalog = {
  add: (asset: Asset) => Asset
  find: (assetId: string) => Asset | null
  /** The local asset an API one became, so a generation's parent can be tied to its channels. */
  findByRemoteId: (remoteAssetId: string) => Asset | null
  search: (query: AssetQuery) => Asset[]
  close: () => void
}

export function createCatalog(driver: SqliteDriver): Catalog {
  migrate(driver)

  const insertAsset = driver.prepare(`
    INSERT OR REPLACE INTO assets
      (id, name, type, location, path, remote_asset_id, job_id, width, height, bytes,
       created_at, derived_from, source_path, hash, probe, proxy_path, peaks_path,
       map, map_inverted)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const deleteTags = driver.prepare('DELETE FROM asset_tags WHERE asset_id = ?')
  const insertTag = driver.prepare('INSERT OR IGNORE INTO asset_tags (asset_id, tag) VALUES (?, ?)')
  const selectTags = driver.prepare('SELECT tag FROM asset_tags WHERE asset_id = ? ORDER BY tag')
  const selectAsset = driver.prepare('SELECT * FROM assets WHERE id = ?')
  // Oldest first: re-importing the same API asset must not move where its children point.
  const selectByRemoteId = driver.prepare(
    'SELECT * FROM assets WHERE remote_asset_id = ? ORDER BY created_at, id LIMIT 1',
  )

  const tagsOf = (assetId: string): string[] => selectTags.all(assetId).map(row => text(row, 'tag'))

  /**
   * One query for the whole page rather than one per row: a 200-asset search was 201
   * synchronous queries, and a synchronous query in the main process blocks every window.
   */
  const tagsByAsset = (assetIds: readonly string[]): Map<string, string[]> => {
    const grouped = new Map<string, string[]>()
    if (assetIds.length === 0) return grouped

    const placeholders = assetIds.map(() => '?').join(', ')
    const rows = driver
      .prepare(`SELECT asset_id, tag FROM asset_tags WHERE asset_id IN (${placeholders})`)
      .all(...assetIds)

    for (const row of rows) {
      const assetId = text(row, 'asset_id')
      const existing = grouped.get(assetId)
      if (existing) existing.push(text(row, 'tag'))
      else grouped.set(assetId, [text(row, 'tag')])
    }

    for (const tags of grouped.values()) tags.sort()
    return grouped
  }

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
        asset.sourcePath ?? null,
        asset.hash ?? null,
        asset.probe ? JSON.stringify(asset.probe) : null,
        asset.proxyPath ?? null,
        asset.peaksPath ?? null,
        asset.map ?? null,
        asset.mapInverted ? 1 : null,
      )

      deleteTags.run(asset.id)
      for (const tag of asset.tags) insertTag.run(asset.id, tag)

      return asset
    },

    find: assetId => {
      const row = selectAsset.get(assetId)
      return row ? assetOf(row, tagsOf(assetId)) : null
    },

    findByRemoteId: remoteAssetId => {
      const row = selectByRemoteId.get(remoteAssetId)
      if (!row) return null
      return assetOf(row, tagsOf(text(row, 'id')))
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

      const tags = tagsByAsset(rows.map(row => text(row, 'id')))
      return rows.map(row => assetOf(row, tags.get(text(row, 'id')) ?? []))
    },

    close: () => driver.close(),
  }
}

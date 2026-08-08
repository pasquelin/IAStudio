import { defined, isRecord } from '@shared/guards'
import {
  isAssetType,
  isSyncStatus,
  mediaProbeOf,
  probeNumber,
  type Asset,
  type AssetGeneration,
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
  `
  -- Provenance, at last persisted. Columns rather than one JSON blob for the three that are
  -- searched — "everything made with Flux", "the one whose prompt said moss" — and JSON for
  -- the parameters, which are open by nature and never filtered on, as the probe already is.
  ALTER TABLE assets ADD COLUMN model_id    TEXT;
  ALTER TABLE assets ADD COLUMN model_label TEXT;
  ALTER TABLE assets ADD COLUMN prompt      TEXT;
  ALTER TABLE assets ADD COLUMN seed        INTEGER;
  ALTER TABLE assets ADD COLUMN gen_params  TEXT;

  -- The twin in the library, and the three stamps that place the two sides against each other.
  -- Only two of the six sync states are ever written today, because pushing and pulling are
  -- explicit; the stamps are recorded from the start so that computing the rest later is a
  -- change of policy rather than a migration.
  ALTER TABLE assets ADD COLUMN remote_owner_id   TEXT;
  ALTER TABLE assets ADD COLUMN remote_updated_at TEXT;
  ALTER TABLE assets ADD COLUMN remote_synced_at  TEXT;
  ALTER TABLE assets ADD COLUMN local_changed_at  TEXT;
  ALTER TABLE assets ADD COLUMN sync_state        TEXT;
  ALTER TABLE assets ADD COLUMN sync_error        TEXT;

  -- What ties the outputs of one generation together. The API has no notion of a set.
  ALTER TABLE assets ADD COLUMN group_id     TEXT;
  ALTER TABLE assets ADD COLUMN output_index INTEGER;

  CREATE INDEX assets_model_id_idx   ON assets(model_id);
  CREATE INDEX assets_group_id_idx   ON assets(group_id);
  CREATE INDEX assets_sync_state_idx ON assets(sync_state);
  -- Paired: a twin is only meaningful under the project whose key opens onto it.
  CREATE INDEX assets_remote_owner_idx ON assets(remote_owner_id, remote_asset_id);
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
  const map = optionalText(row, 'map')
  const syncState = optionalText(row, 'sync_state')

  return {
    id: text(row, 'id'),
    name: text(row, 'name'),
    type: assetType(row),
    location: text(row, 'location') === 'cloud' ? 'cloud' : 'local',
    tags,
    createdAt: text(row, 'created_at'),
    ...defined({
      path: optionalText(row, 'path'),
      remoteAssetId: optionalText(row, 'remote_asset_id'),
      remoteOwnerId: optionalText(row, 'remote_owner_id'),
      remoteUpdatedAt: optionalText(row, 'remote_updated_at'),
      remoteSyncedAt: optionalText(row, 'remote_synced_at'),
      localChangedAt: optionalText(row, 'local_changed_at'),
      // Free strings in SQLite: a state this build no longer knows is dropped rather than
      // carried into a union that does not contain it.
      syncStatus: isSyncStatus(syncState) ? syncState : undefined,
      syncError: optionalText(row, 'sync_error'),
      jobId: optionalText(row, 'job_id'),
      derivedFrom: optionalText(row, 'derived_from'),
      groupId: optionalText(row, 'group_id'),
      outputIndex: optionalNumber(row, 'output_index'),
      generation: parseGeneration(row),
      width: optionalNumber(row, 'width'),
      height: optionalNumber(row, 'height'),
      bytes: optionalNumber(row, 'bytes'),
      sourcePath: optionalText(row, 'source_path'),
      hash: optionalText(row, 'hash'),
      probe: parseProbe(optionalText(row, 'probe')),
      proxyPath: optionalText(row, 'proxy_path'),
      peaksPath: optionalText(row, 'peaks_path'),
    }),
    // The column is a free string in SQLite; a channel this build no longer knows leaves the
    // asset as an ordinary picture rather than making the whole row unreadable.
    ...(isPbrChannel(map)
      ? { map, ...(optionalNumber(row, 'map_inverted') === 1 ? { mapInverted: true } : {}) }
      : {}),
  }
}

/**
 * The generation spread across its columns and back. Without a model there is no generation:
 * an imported file has none, and a row that kept only a prompt could not be run again.
 */
function parseGeneration(row: SqlRow): AssetGeneration | undefined {
  const modelId = optionalText(row, 'model_id')
  if (modelId === undefined) return undefined

  const seed = optionalNumber(row, 'seed')
  return {
    modelId,
    modelLabel: text(row, 'model_label'),
    prompt: text(row, 'prompt'),
    params: parseParams(optionalText(row, 'gen_params')),
    ...defined({ seed }),
  }
}

function parseParams(raw: string | undefined): Record<string, unknown> {
  if (raw === undefined) return {}

  try {
    const parsed: unknown = JSON.parse(raw)
    return isRecord(parsed) ? parsed : {}
  } catch {
    return {}
  }
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
  /** The row holding these exact bytes, if the project already imported them once. */
  findByHash: (hash: string) => Asset | null
  search: (query: AssetQuery) => Asset[]
  /**
   * Drops a row and the references the catalogue itself holds to it. What lives on disk is the
   * caller's business: the proxy and the waveform are named after a hash that other rows may
   * share, so only the caller knows whether they are still wanted.
   */
  remove: (assetId: string) => void
  close: () => void
}

export function createCatalog(driver: SqliteDriver): Catalog {
  migrate(driver)

  const insertAsset = driver.prepare(`
    INSERT OR REPLACE INTO assets
      (id, name, type, location, path, remote_asset_id, job_id, width, height, bytes,
       created_at, derived_from, source_path, hash, probe, proxy_path, peaks_path,
       map, map_inverted,
       model_id, model_label, prompt, seed, gen_params,
       remote_owner_id, remote_updated_at, remote_synced_at, local_changed_at,
       sync_state, sync_error, group_id, output_index)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const deleteTags = driver.prepare('DELETE FROM asset_tags WHERE asset_id = ?')
  const insertTag = driver.prepare('INSERT OR IGNORE INTO asset_tags (asset_id, tag) VALUES (?, ?)')
  const selectTags = driver.prepare('SELECT tag FROM asset_tags WHERE asset_id = ? ORDER BY tag')
  const selectAsset = driver.prepare('SELECT * FROM assets WHERE id = ?')
  // Oldest first: re-importing the same API asset must not move where its children point.
  const selectByRemoteId = driver.prepare(
    'SELECT * FROM assets WHERE remote_asset_id = ? ORDER BY created_at, id LIMIT 1',
  )
  // Same order, same reason: the row that has been there longest is the one carrying the tags
  // and the proxy, and it is the one a second import of the same file must land on.
  const selectByHash = driver.prepare(
    'SELECT * FROM assets WHERE hash = ? ORDER BY created_at, id LIMIT 1',
  )
  const deleteAsset = driver.prepare('DELETE FROM assets WHERE id = ?')
  // A child pointing at a parent that is gone reads back as a derivation from nothing, and
  // every inspector that follows the link would have to guard against a row that cannot exist.
  const orphanChildren = driver.prepare(
    'UPDATE assets SET derived_from = NULL WHERE derived_from = ?',
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
        asset.generation?.modelId ?? null,
        asset.generation?.modelLabel ?? null,
        asset.generation?.prompt ?? null,
        asset.generation?.seed ?? null,
        asset.generation ? JSON.stringify(asset.generation.params) : null,
        asset.remoteOwnerId ?? null,
        asset.remoteUpdatedAt ?? null,
        asset.remoteSyncedAt ?? null,
        asset.localChangedAt ?? null,
        asset.syncStatus ?? null,
        asset.syncError ?? null,
        asset.groupId ?? null,
        asset.outputIndex ?? null,
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

    findByHash: hash => {
      const row = selectByHash.get(hash)
      return row ? assetOf(row, tagsOf(text(row, 'id'))) : null
    },

    remove: assetId => {
      // One statement's worth of atomicity: a crash between the two would leave children
      // pointing at a row that is gone. The tags follow on their own — `asset_tags` is
      // `ON DELETE CASCADE`, and both drivers turn foreign keys on.
      driver.exec('BEGIN')
      try {
        orphanChildren.run(assetId)
        deleteAsset.run(assetId)
        driver.exec('COMMIT')
      } catch (error) {
        driver.exec('ROLLBACK')
        throw error
      }
    },

    search: query => {
      const conditions: string[] = []
      const params: SqlValue[] = []

      if (query.type) {
        conditions.push('type = ?')
        params.push(query.type)
      }

      // What a workspace asks for: the Image space wants pictures, textures and skyboxes and
      // nothing else. An empty list is not "no filter", it is "nothing" — and it must stay so,
      // or opening a space that accepts no asset would show every asset.
      if (query.types) {
        const placeholders = query.types.map(() => '?').join(', ')
        conditions.push(query.types.length > 0 ? `type IN (${placeholders})` : '0')
        params.push(...query.types)
      }

      if (query.location) {
        conditions.push('location = ?')
        params.push(query.location)
      }

      if (query.syncStatus) {
        conditions.push('sync_state = ?')
        params.push(query.syncStatus)
      }

      if (query.groupId) {
        conditions.push('group_id = ?')
        params.push(query.groupId)
      }

      // The prompt is searched alongside the name: what one remembers of a generated asset is
      // what one asked for, not the label the job happened to give it.
      if (query.text) {
        conditions.push("(name LIKE ? ESCAPE '\\' OR prompt LIKE ? ESCAPE '\\')")
        const pattern = `%${escapeLike(query.text)}%`
        params.push(pattern, pattern)
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

      // The members of one generation are read in the order the API produced them — the seven
      // channels of a material, filling seven slots. Everywhere else, newest first.
      const order = query.groupId ? 'output_index, id' : 'created_at DESC, id DESC'
      const rows = driver
        .prepare(`SELECT * FROM assets ${where} ORDER BY ${order} LIMIT ? OFFSET ?`)
        .all(...params)

      const tags = tagsByAsset(rows.map(row => text(row, 'id')))
      return rows.map(row => assetOf(row, tags.get(text(row, 'id')) ?? []))
    },

    close: () => driver.close(),
  }
}

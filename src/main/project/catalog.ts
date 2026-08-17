import { defined, isRecord } from '@shared/guards'
import {
  ACTIVITY_MESSAGES,
  ACTIVITY_RETENTION,
  ACTIVITY_SCOPE_PREFIX,
  isActivityLevel,
  isActivityTopic,
  type ActivityDraft,
  type ActivityEntry,
  type ActivityMessageKey,
  type ActivityParams,
  type ActivityQuery,
} from '@shared/domain/activity'
import {
  emptyAssetCounts,
  isAssetType,
  isSyncStatus,
  mediaProbeOf,
  probeNumber,
  type Asset,
  type AssetCounts,
  type AssetGeneration,
  type AssetQuery,
  type AssetType,
  type MediaProbe,
} from '@shared/domain/asset'
import { isPbrChannel } from '@shared/domain/texture'
import { LOG_SCOPES } from '@shared/ipc'
import { byCodeUnit } from '@shared/text'
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
  `
  -- What the studio did, and what it failed to do. Append-only: a line is a fact about a moment,
  -- and rewriting one would make the journal argue with what the user saw.
  --
  -- The message is a KEY and its parameters rather than a sentence, so a journal written in one
  -- language reads in whichever the interface is in later. \`detail\` carries \`describeFailure\`
  -- and nothing else — an SDK message embeds the request that produced it, hence the API key.
  CREATE TABLE activity (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    at          TEXT NOT NULL,
    level       TEXT NOT NULL,
    topic       TEXT NOT NULL,
    message_key TEXT NOT NULL,
    params      TEXT,
    detail      TEXT,
    asset_id    TEXT
  );

  -- No index: \`id INTEGER PRIMARY KEY\` IS the rowid, so the table is already stored in the one
  -- order the journal is ever read in. A second B-tree would be maintained on every insert —
  -- two hundred of them on a push of two hundred assets — and answer no query the first cannot.
  `,
  `
  -- The page every browser opens on, and the one the audit measured at 15,17 ms: one kind,
  -- newest first. Neither simple index could answer it whole — SQLite picks the one that
  -- narrows, then walks what it found to sort it. The tie-break column is here because the
  -- query carries it: without \`id DESC\` in the index, the sort survives the seek.
  CREATE INDEX assets_type_created_idx ON assets(type, created_at DESC, id DESC);

  -- Full text over what one remembers of an asset — its name, and what was asked for. The
  -- \`LIKE '%…%'\` it replaces could not use any index by construction: 22,53 ms to answer that
  -- nothing matched, because answering that means reading everything.
  --
  -- \`content='assets'\`: the words are indexed, the columns are not stored a second time.
  -- Diacritics folded, so « mousse » finds "Mousse" typed without its accent in a hurry.
  CREATE VIRTUAL TABLE assets_fts USING fts5(
    name,
    prompt,
    content='assets',
    content_rowid='rowid',
    tokenize='unicode61 remove_diacritics 2'
  );

  -- An external-content table indexes nothing by itself: these three are what keep it true, and
  -- a delete is written as a command rather than as a DELETE — that is the fts5 contract.
  CREATE TRIGGER assets_fts_insert AFTER INSERT ON assets BEGIN
    INSERT INTO assets_fts(rowid, name, prompt) VALUES (new.rowid, new.name, new.prompt);
  END;

  CREATE TRIGGER assets_fts_delete AFTER DELETE ON assets BEGIN
    INSERT INTO assets_fts(assets_fts, rowid, name, prompt)
      VALUES ('delete', old.rowid, old.name, old.prompt);
  END;

  CREATE TRIGGER assets_fts_update AFTER UPDATE ON assets BEGIN
    INSERT INTO assets_fts(assets_fts, rowid, name, prompt)
      VALUES ('delete', old.rowid, old.name, old.prompt);
    INSERT INTO assets_fts(rowid, name, prompt) VALUES (new.rowid, new.name, new.prompt);
  END;

  -- What is already there. A project opened after this migration must be searchable at once,
  -- not from its next import onwards.
  INSERT INTO assets_fts(rowid, name, prompt) SELECT rowid, name, prompt FROM assets;
  `,
  `
  -- « Is the file the explorer is showing one of ours? », asked on every double-click over a
  -- folder that can hold thousands. Without it the equality is a full scan of \`assets\`, and the
  -- gesture waits on it: the thread it blocks is the catalogue's own worker, not the main
  -- process — \`catalogClient\` is what keeps that true, and it is why no window freezes here.
  CREATE INDEX assets_path_idx ON assets(path);
  `,
  `
  -- The still of an asset whose own file no browser can decode — a mesh's, above all. Kept as a
  -- path like the proxy and the waveform, and rebuildable like both: the file is the library's
  -- own thumbnail, brought down beside the bytes so a downloaded model stays a picture in a grid.
  ALTER TABLE assets ADD COLUMN poster_path TEXT;
  `,
  `
  -- When the rescan last found nothing at this row's path. A file that has gone is DATED, never
  -- deleted: the row carries the prompt, the seed and the lineage, and none of that is on the
  -- disk. Cleared the moment the file is found again, under this path or another.
  --
  -- It is also what makes the rescan idempotent where it is visible: a second pass over the same
  -- state finds the absence already dated and says nothing to the journal, so running it on
  -- every open and every focus does not write a line each time.
  ALTER TABLE assets ADD COLUMN missing_at TEXT;

  -- PARTIAL, and it has to be: in the ordinary project every row is NULL here, so a plain index
  -- would be the size of the table, maintained on every insert, and answer nothing — the two
  -- queries that read this column ask \`IS NULL\`, which no index serves. What IS worth an index
  -- is the handful of dated rows, which is what a listing of them would seek.
  CREATE INDEX assets_missing_at_idx ON assets(missing_at) WHERE missing_at IS NOT NULL;
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
      posterPath: optionalText(row, 'poster_path'),
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

/**
 * `assets/img/` and `assets/img` are one folder to the filesystem and two strings to SQLite.
 * Every path that reaches a comparison here goes through this first.
 */
function withoutTrailingSlash(path: string): string {
  return path.replace(/\/+$/, '')
}

/** Whether `path` sits strictly inside `folder` — the shape `shared/domain/folder.ts` uses. */
function isUnder(path: string, folder: string): boolean {
  return path.startsWith(`${folder}/`)
}

/** `%` and `_` are wildcards: typed by a user they must match themselves, not everything. */
function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, character => `\\${character}`)
}

/**
 * What the user typed, as an fts5 expression — or `null` when nothing they typed is a word.
 *
 * Words only, and quoted: `-`, `*`, `AND` and `(` are operators in that grammar, and a name is
 * not a query. The trailing star is what makes the row appear while the word is still being
 * typed, which is the only reason a search runs on every keystroke at all.
 *
 * Every term must match, as the tag filter does: filters narrow, they do not widen.
 */
function matchExpression(text: string): string | null {
  const terms = text.match(/[\p{L}\p{N}_]+/gu)
  return terms ? terms.map(term => `"${term}"*`).join(' AND ') : null
}

/**
 * All or nothing, on a driver where forgetting the `ROLLBACK` leaves a transaction open for the
 * rest of the session — and every window behind it.
 */
function transaction<T>(driver: SqliteDriver, body: () => T): T {
  driver.exec('BEGIN')
  try {
    const result = body()
    driver.exec('COMMIT')
    return result
  } catch (error) {
    driver.exec('ROLLBACK')
    throw error
  }
}

/**
 * The interpolations of a message key, back from the JSON they were stored as.
 *
 * Anything else is dropped rather than trusted: a value that is neither a string nor a number
 * would reach `t()` as `[object Object]`, and a line nobody can read is worse than one missing
 * a number.
 */
function activityParams(row: SqlRow): ActivityParams | undefined {
  const raw = optionalText(row, 'params')
  if (raw === undefined) return undefined

  const params: ActivityParams = {}
  for (const [key, value] of Object.entries(parseParams(raw))) {
    if (typeof value === 'string' || typeof value === 'number') params[key] = value
  }
  return params
}

/**
 * Every key a stored line may name. Scopes are resolved against `LOG_SCOPES` here rather than in
 * the domain: the list lives at the boundary, which depends on the domain and not the reverse —
 * and the main process may read it, as `diagnostics/validation.ts` already does. Checking only
 * the prefix would let a scope retired since read as itself on screen.
 */
const KNOWN_MESSAGE_KEYS = new Set<string>([
  ...ACTIVITY_MESSAGES.map(name => `activity.${name}`),
  ...LOG_SCOPES.map(scope => `${ACTIVITY_SCOPE_PREFIX}${scope}`),
])

function knownMessageKey(value: string): value is ActivityMessageKey {
  return KNOWN_MESSAGE_KEYS.has(value)
}

/**
 * One row, read back. `level` and `topic` are closed unions in the domain and free strings in
 * SQLite: a line written by a build that knew one more of either is read as an ordinary line
 * rather than taking the panel down with it.
 */
function activityOf(row: SqlRow): ActivityEntry {
  const level = text(row, 'level')
  const topic = text(row, 'topic')
  // A line outlives the version that wrote it: a key renamed since would come back naming
  // nothing, and the window would draw it as itself.
  const messageKey = text(row, 'message_key')
  const params = activityParams(row)
  const detail = optionalText(row, 'detail')
  const assetId = optionalText(row, 'asset_id')

  return {
    id: optionalNumber(row, 'id') ?? 0,
    at: text(row, 'at'),
    level: isActivityLevel(level) ? level : 'info',
    topic: isActivityTopic(topic) ? topic : 'library',
    messageKey: knownMessageKey(messageKey) ? messageKey : 'activity.unknownMessage',
    ...defined({ params, detail, assetId }),
  }
}

/**
 * One filed row, as reconciling with the disk reads it — its path, what identifies its bytes,
 * and when it was last found to be gone.
 *
 * Deliberately not an `Asset`: the rescan compares paths and fingerprints, and carrying the
 * prompt and the generation parameters of every row across a thread for that would be the cost
 * this shape exists to avoid.
 */
export type FiledAsset = {
  /**
   * What the pass writes back by. NOT the path: the pass reads every row, then gives the thread
   * back while it fingerprints, and the queue goes on serving `repath` and `add` in between — a
   * write aimed at a path would land on whichever row occupies it by then, which is how a row
   * whose file is perfectly present gets dated in place of the one that went.
   */
  id: string
  path: string
  hash: string | null
  missingAt: string | null
}

/**
 * One row as the backup keeps it — what a reader would need to recognise a file again if the
 * catalogue itself were gone.
 *
 * The provenance and nothing else: what the file is, what it was called, and what was asked for
 * to make it. Everything derived — the proxy, the waveform, the poster — is rebuildable from the
 * file, and everything about the remote twin belongs to an account rather than to a project.
 */
export type BackedUpItem = {
  hash: string
  id: string
  name: string
  type: string
  path: string
  createdAt: string
  tags: string[]
  prompt?: string
  modelId?: string
  seed?: number
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
   * How many rows each kind holds. One grouped query rather than six searches: the home draws
   * the six numbers at once, and counting in SQL never carries a row across the thread.
   */
  countByType: () => AssetCounts
  /**
   * Drops a row and the references the catalogue itself holds to it. What lives on disk is the
   * caller's business: the proxy and the waveform are named after a hash that other rows may
   * share, so only the caller knows whether they are still wanted.
   */
  remove: (assetId: string) => void
  /**
   * Follows a file that moved: the row filed at `from` is refiled at `to`, and so is everything
   * beneath it when `from` is a folder. The ids do not change, which is the whole point — a
   * scene referring to a texture keeps referring to it however the user rearranges the project.
   *
   * Idempotent, and that is what makes a replayed journal safe: run twice, the second pass finds
   * nothing at `from` and writes nothing.
   *
   * The caller moves the file FIRST and calls this second. The other order leaves a row pointing
   * at a path nothing is at.
   */
  repath: (from: string, to: string) => void
  /**
   * Dates the row filed at `path`, and every row beneath it, as gone — a folder sent to the
   * trash. Answers how many rows it touched.
   *
   * DATED and not dropped, which is what makes it agree with the rescan rather than fight it:
   * the system trash is reversible, and a row deleted the moment a file went there would leave
   * a restored file with no prompt, no seed and no lineage — the one copy of all three. Dated,
   * the next pass sees the file back where the catalogue says and clears the date, and the
   * whole gesture undoes itself without the studio having to have watched the trash.
   *
   * A folder is not an asset, so no id can say what went; the path is the only handle.
   */
  forgetUnder: (path: string) => number
  /**
   * Every row that names a file, and only what reconciling the catalogue with the disk reads of
   * one. The whole table at once rather than a query per file: a project of a hundred thousand
   * assets is one statement here and a hundred thousand round trips the other way.
   */
  filed: () => FiledAsset[]
  /**
   * Dates a row as gone, or clears the date when its file is back. BY ID — see `FiledAsset.id`.
   *
   * The row itself is never dropped: it carries the prompt, the seed and the lineage, and none
   * of that is on the disk. A file the user moved outside the studio comes back to its row by
   * fingerprint; one they deleted stays dated.
   */
  markMissing: (assetId: string, at: string | null) => void
  /**
   * Every row that has a file AND a fingerprint, as the backup keeps them.
   *
   * Its own query rather than a `search`: what goes into the backup is a handful of columns, and
   * carrying whole assets — the probe, the generation parameters, the sync stamps — for a file
   * that keeps none of them would be the cost this shape exists to avoid.
   */
  backup: () => BackedUpItem[]
  /**
   * Writes lines to the journal, in one transaction, and trims it back to its bound.
   *
   * A batch rather than one line at a time: a push of two hundred assets writes two hundred
   * lines, and two hundred transactions on a synchronous driver is the sort of thing that shows
   * up as a frozen window.
   */
  appendActivity: (entries: readonly ActivityDraft[]) => ActivityEntry[]
  /** Newest first, which is the order the panel opens on. */
  readActivity: (query: ActivityQuery) => ActivityEntry[]
  close: () => void
}

export function createCatalog(driver: SqliteDriver): Catalog {
  migrate(driver)

  const insertAsset = driver.prepare(`
    INSERT OR REPLACE INTO assets
      (id, name, type, location, path, remote_asset_id, job_id, width, height, bytes,
       created_at, derived_from, source_path, hash, probe, proxy_path, peaks_path, poster_path,
       map, map_inverted,
       model_id, model_label, prompt, seed, gen_params,
       remote_owner_id, remote_updated_at, remote_synced_at, local_changed_at,
       sync_state, sync_error, group_id, output_index)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const deleteTags = driver.prepare('DELETE FROM asset_tags WHERE asset_id = ?')
  const insertTag = driver.prepare('INSERT OR IGNORE INTO asset_tags (asset_id, tag) VALUES (?, ?)')
  // Not `ORDER BY tag`: SQLite answers that in BINARY collation over UTF-8 bytes, where the page
  // path below sorted by UTF-16 code unit — the same asset listed its tags two ways past the BMP.
  // Both order in JavaScript now, and what this port owes is the same answer twice, not a reading
  // order: nothing displays these tags yet, and the catalogue runs on a worker holding a database
  // path and nothing else, so a collation here could not follow the reader's language anyway.
  const selectTags = driver.prepare('SELECT tag FROM asset_tags WHERE asset_id = ?')
  const selectAsset = driver.prepare('SELECT * FROM assets WHERE id = ?')

  /**
   * A path and everything filed under it, written so the index on `path` can answer it.
   *
   * **Not `LIKE`.** SQLite's `LIKE` is case-INSENSITIVE over ASCII unless a pragma says
   * otherwise — and that pragma is global, so turning it on would change what the text search
   * below matches. Left as it is, moving `Rushes` would have carried `RUSHES/A001.mov` with it.
   *
   * **Not `substr` either.** Exact, but it hides the column from `assets_path_idx` and turns
   * every move into a full scan of the table.
   *
   * A range does both. `'0'` is the code point right after `/`, so `>= 'p/'` and `< 'p0'` holds
   * exactly the paths beginning with `p/` — no wildcard to escape, no case folding, and a
   * comparison the index answers directly.
   */
  const UNDER_PATH = 'path = ? OR (path >= ? AND path < ?)'

  /** The three parameters `UNDER_PATH` wants, in order. */
  const underPath = (path: string): [string, string, string] => [path, `${path}/`, `${path}0`]

  /**
   * The length is measured by SQLite rather than passed in: `length()` counts CHARACTERS in text
   * where JavaScript's `.length` counts UTF-16 units, so a folder named with an emoji would have
   * been cut one unit too far and every path under it rewritten wrong.
   */
  const movePaths = driver.prepare(`
    UPDATE assets
       SET path = ? || substr(path, length(?) + 1)
     WHERE ${UNDER_PATH}
  `)

  // Only what is not already dated: a folder thrown away twice would otherwise report the same
  // rows again, and a pass over the same state has to say nothing the second time.
  const missUnder = driver.prepare(
    `UPDATE assets SET missing_at = ? WHERE missing_at IS NULL AND (${UNDER_PATH})`,
  )

  // Every filed row, and only what the rescan reads of one. `SELECT *` would carry the prompt and
  // the generation parameters of a hundred thousand assets across a thread for nothing.
  const selectFiled = driver.prepare(
    "SELECT id, path, hash, missing_at FROM assets WHERE path IS NOT NULL AND path <> ''",
  )

  const setMissingAt = driver.prepare('UPDATE assets SET missing_at = ? WHERE id = ?')

  const selectBackup = driver.prepare(`
    SELECT id, name, type, path, created_at, hash, prompt, model_id, seed
      FROM assets
     WHERE hash IS NOT NULL AND hash <> '' AND path IS NOT NULL AND path <> ''
     ORDER BY created_at, id
  `)

  // The port's `run` answers nothing, so what the DELETE touched is asked for separately. Inside
  // the same transaction, where no other statement can have run in between.
  const rowsChanged = driver.prepare('SELECT changes() AS touched')

  // Oldest first: re-importing the same API asset must not move where its children point.
  //
  // No `missing_at IS NULL` here, unlike `findByHash` below, and the difference is what the two
  // questions are. This one asks which local row an API asset IS, not whether its bytes are
  // there: a pull writes over the row it finds, so filtering would leave a dated row beside a
  // fresh duplicate instead of repairing it, and would cut the lineage of a texture whose parent
  // picture the user has tidied away. A caller that is about to act on the FILE asks the disk —
  // see the collector, which will not skip a download for a row whose file has gone.
  const selectByRemoteId = driver.prepare(
    'SELECT * FROM assets WHERE remote_asset_id = ? ORDER BY created_at, id LIMIT 1',
  )
  // Same order, same reason: the row that has been there longest is the one carrying the tags
  // and the proxy, and it is the one a second import of the same file must land on.
  // `missing_at IS NULL`, because this is what an import asks to know whether the project already
  // holds these bytes. A row whose file is gone does not: answering it would call the import a
  // duplicate of something that is not there, and the copy just written would be discarded.
  const selectByHash = driver.prepare(
    'SELECT * FROM assets WHERE hash = ? AND missing_at IS NULL ORDER BY created_at, id LIMIT 1',
  )
  const insertActivity = driver.prepare(`
    INSERT INTO activity (at, level, topic, message_key, params, detail, asset_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  // By id rather than by age: the journal is append-only, so the id IS the order, and a clock
  // that went backwards between two launches would otherwise decide what to keep.
  const pruneActivity = driver.prepare(`
    DELETE FROM activity
    WHERE id <= (SELECT MAX(id) FROM activity) - ?
  `)
  const selectActivity = driver.prepare('SELECT * FROM activity ORDER BY id DESC LIMIT ?')
  // Ascending, to pair with the drafts in the order they were handed over.
  const selectActivityIds = driver.prepare(
    'SELECT id FROM (SELECT id FROM activity ORDER BY id DESC LIMIT ?) ORDER BY id',
  )
  // Answered by `assets_type_idx` alone, without reading a single row.
  // `missing_at IS NULL` for the reason `search` carries it: the home draws these six numbers
  // beside a grid that shows what is there, and counting what it does not show would put a
  // number under a shelf nothing fills.
  const countTypes = driver.prepare(
    'SELECT type, COUNT(*) AS total FROM assets WHERE missing_at IS NULL GROUP BY type',
  )
  const deleteAsset = driver.prepare('DELETE FROM assets WHERE id = ?')
  // A child pointing at a parent that is gone reads back as a derivation from nothing, and
  // every inspector that follows the link would have to guard against a row that cannot exist.
  const orphanChildren = driver.prepare(
    'UPDATE assets SET derived_from = NULL WHERE derived_from = ?',
  )

  const tagsOf = (assetId: string): string[] =>
    selectTags
      .all(assetId)
      .map(row => text(row, 'tag'))
      .sort(byCodeUnit)

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

    for (const tags of grouped.values()) tags.sort(byCodeUnit)
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
        asset.posterPath ?? null,
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
      transaction(driver, () => {
        orphanChildren.run(assetId)
        deleteAsset.run(assetId)
      })
    },

    repath: (from, to) => {
      const source = withoutTrailingSlash(from)
      const target = withoutTrailingSlash(to)

      // An empty path names the project root, which is not something a row can be filed at.
      if (!source || !target || source === target) return

      /**
       * A folder cannot be moved INTO itself, and the refusal belongs here rather than only in
       * the caller that already forbids the gesture.
       *
       * Without it this operation stops being idempotent, which is the property a replayed
       * journal rests on: rewriting `Rushes` to `Rushes/2024` leaves rows that still begin with
       * `Rushes/`, so a second pass files them at `Rushes/2024/2024/…`, and every replay sinks
       * them one level deeper.
       */
      if (isUnder(target, source)) return

      movePaths.run(target, source, ...underPath(source))
    },

    filed: () =>
      selectFiled.all().map(row => ({
        id: text(row, 'id'),
        path: text(row, 'path'),
        hash: optionalText(row, 'hash') ?? null,
        missingAt: optionalText(row, 'missing_at') ?? null,
      })),

    markMissing: (assetId, at) => {
      if (!assetId) return
      setMissingAt.run(at, assetId)
    },

    backup: () => {
      const rows = selectBackup.all()
      // The grouped read, for the reason a search uses it: a project of ten thousand assets would
      // otherwise be ten thousand more queries, in the thread that answers every window's.
      const tags = tagsByAsset(rows.map(row => text(row, 'id')))

      return rows.map(row => {
        const seed = optionalNumber(row, 'seed')
        const prompt = optionalText(row, 'prompt')
        const modelId = optionalText(row, 'model_id')

        return {
          hash: text(row, 'hash'),
          id: text(row, 'id'),
          name: text(row, 'name'),
          type: text(row, 'type'),
          path: text(row, 'path'),
          createdAt: text(row, 'created_at'),
          tags: tags.get(text(row, 'id')) ?? [],
          ...(prompt === undefined ? {} : { prompt }),
          ...(modelId === undefined ? {} : { modelId }),
          ...(seed === undefined ? {} : { seed }),
        }
      })
    },

    forgetUnder: path => {
      // `assets/img/` and `assets/img` name one folder to the filesystem and two strings to
      // SQLite. Left as typed, the trailing slash made this touch nothing at all — silently,
      // and after the files had already gone to the trash.
      const root = withoutTrailingSlash(path)
      if (!root) return 0

      // Nothing is orphaned and nothing is dropped: the rows are all still there, and a child
      // still points at the parent it was derived from. Only the date changes.
      return transaction(driver, () => {
        missUnder.run(new Date().toISOString(), ...underPath(root))
        return optionalNumber(rowsChanged.get() ?? {}, 'touched') ?? 0
      })
    },

    search: query => {
      // What is not there is not shown. A row dated gone keeps everything only it holds — the
      // prompt, the seed, the lineage — and a browser that drew it would draw a card whose
      // picture cannot load and whose file cannot open. The moment the file is back, the rescan
      // clears the date and the row comes back with it: a folder thrown away and taken out of
      // the trash reappears whole, which is what dating instead of deleting buys.
      const conditions: string[] = ['missing_at IS NULL']
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

      // What the explorer asks before it hands a file to the system: a row filed at this exact
      // path, or none. Both sides spell it with `/` — see `relativePathFor`.
      if (query.path) {
        conditions.push('path = ?')
        params.push(query.path)
      }

      // The same question for a whole listing, in one round trip: a browser showing four hundred
      // files would otherwise ask four hundred times to learn which of them are ours. Empty means
      // nothing, exactly as `types` does — a caller with no path to ask about asks nothing.
      if (query.paths) {
        const placeholders = query.paths.map(() => '?').join(', ')
        conditions.push(query.paths.length > 0 ? `path IN (${placeholders})` : '0')
        params.push(...query.paths)
      }

      // What a finished generation hands back is ids and nothing else, so this is how its output
      // is read. Empty means nothing, as it does for `paths` just above.
      if (query.ids) {
        const placeholders = query.ids.map(() => '?').join(', ')
        conditions.push(query.ids.length > 0 ? `id IN (${placeholders})` : '0')
        params.push(...query.ids)
      }

      if (query.syncStatus) {
        conditions.push('sync_state = ?')
        params.push(query.syncStatus)
      }

      if (query.groupId) {
        conditions.push('group_id = ?')
        params.push(query.groupId)
      }

      if (query.derivedFrom) {
        conditions.push('derived_from = ?')
        params.push(query.derivedFrom)
      }

      // The column `parseGeneration` keys off: without a model there is no generation, so this
      // is exactly the set of rows the studio made rather than the ones it was handed.
      if (query.generated) conditions.push('model_id IS NOT NULL')

      // The prompt is searched alongside the name: what one remembers of a generated asset is
      // what one asked for, not the label the job happened to give it.
      if (query.text) {
        const match = matchExpression(query.text)

        if (match) {
          conditions.push('rowid IN (SELECT rowid FROM assets_fts WHERE assets_fts MATCH ?)')
          params.push(match)
        } else {
          // Punctuation alone tokenises to nothing, and fts5 cannot look for what it never
          // indexed — searching "%" and finding "100%" is what this keeps. The scan it costs is
          // the one the index exists to avoid, which is why it is the exception and not the rule.
          conditions.push("(name LIKE ? ESCAPE '\\' OR prompt LIKE ? ESCAPE '\\')")
          const pattern = `%${escapeLike(query.text)}%`
          params.push(pattern, pattern)
        }
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

    countByType: () => {
      const counts = emptyAssetCounts()

      for (const row of countTypes.all()) {
        const type = text(row, 'type')
        // A kind this build no longer knows is dropped rather than counted under another.
        if (isAssetType(type)) counts[type] = optionalNumber(row, 'total') ?? 0
      }

      return counts
    },

    appendActivity: entries => {
      if (entries.length === 0) return []

      // One transaction for the whole batch: a push of two hundred assets writes two hundred
      // lines, and two hundred commits on a synchronous driver is a window that stops drawing.
      transaction(driver, () => {
        for (const entry of entries) {
          insertActivity.run(
            entry.at,
            entry.level,
            entry.topic,
            entry.messageKey,
            entry.params === undefined ? null : JSON.stringify(entry.params),
            entry.detail ?? null,
            entry.assetId ?? null,
          )
        }

        // Trimmed here rather than on a timer: this is the only place the journal grows, and a
        // bound nobody enforces is a bound written in a comment.
        pruneActivity.run(ACTIVITY_RETENTION)
      })

      // The ids alone, paired back onto the drafts the caller still holds: `run` answers nothing
      // through the port, and re-reading whole rows would re-parse params we just serialised.
      // Ascending, so a batch longer than the retention keeps its surviving tail.
      const ids = selectActivityIds.all(entries.length).map(row => optionalNumber(row, 'id') ?? 0)
      return entries.slice(-ids.length).map((entry, index) => ({ ...entry, id: ids[index] ?? 0 }))
    },

    // Narrowing by level or topic is the window's job: it holds what it was given, so a filter
    // costs it no round trip. This answers a count, newest first, and nothing else.
    readActivity: query => selectActivity.all(query.limit ?? DEFAULT_LIMIT).map(activityOf),

    close: () => driver.close(),
  }
}

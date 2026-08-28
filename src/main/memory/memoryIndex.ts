import {
  MEMORY_PAGE,
  type Memory,
  type MemoryQuery,
  type MemoryRef,
  type MemoryRefKind,
  type MemorySourceKind,
  type MemoryState,
  type MemoryType,
} from '@shared/domain/assistantMemory'
import { matchExpression } from '@main/project/ftsMatch'
import type { SqliteDriver, SqlRow, SqlValue } from '@main/project/sqlite'
import { migrateTo, transaction } from '@main/project/sqlMigrate'
import { number, optionalText, text } from '@main/project/sqlRow'

/**
 * The searchable half of the memory — DERIVED, and thrown away without a second thought.
 *
 * The file (`memoryStore.ts`) is what HOLDS the memories; this only answers questions about them.
 * That is why it lives under `.index/`, which the studio's own `.gitignore` excludes: a project
 * cloned without this opens and rebuilds it, where a project cloned without the file has lost
 * something no rebuild can recover.
 */

/**
 * Schema history. Append only: an existing index carries its version in `user_version`, and
 * rewriting a past entry would leave already-created indexes on a schema nobody describes.
 */
const MIGRATIONS: readonly string[] = [
  `
  CREATE TABLE memories (
    id          TEXT PRIMARY KEY,
    type        TEXT NOT NULL,
    summary     TEXT NOT NULL,
    body        TEXT NOT NULL,
    importance  INTEGER NOT NULL,
    created_at  TEXT NOT NULL,
    used_at     TEXT,
    source_kind TEXT NOT NULL,
    source_ref  TEXT,
    state       TEXT NOT NULL,
    supersedes  TEXT
  );

  CREATE TABLE memory_refs (
    memory_id TEXT NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    kind      TEXT NOT NULL,
    ref       TEXT NOT NULL,
    PRIMARY KEY (memory_id, kind, ref)
  );

  -- \`to_id\` carries no reference on purpose: a link may name a memory this file has not read
  -- yet, and a constraint would refuse the first half of a pair written in one order.
  CREATE TABLE memory_links (
    from_id TEXT NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    to_id   TEXT NOT NULL,
    PRIMARY KEY (from_id, to_id)
  );

  -- \`content='memories'\`: the words are indexed, the columns are not stored a second time.
  -- Diacritics folded, so « taillé » is found by someone who typed « taille » in a hurry.
  CREATE VIRTUAL TABLE memories_fts USING fts5(
    summary,
    body,
    content='memories',
    content_rowid='rowid',
    tokenize='unicode61 remove_diacritics 2'
  );

  -- An external-content table indexes nothing by itself: these three are what keep it true, and
  -- a delete is written as a command rather than as a DELETE — that is the fts5 contract.
  CREATE TRIGGER memories_fts_insert AFTER INSERT ON memories BEGIN
    INSERT INTO memories_fts(rowid, summary, body) VALUES (new.rowid, new.summary, new.body);
  END;

  CREATE TRIGGER memories_fts_delete AFTER DELETE ON memories BEGIN
    INSERT INTO memories_fts(memories_fts, rowid, summary, body)
      VALUES ('delete', old.rowid, old.summary, old.body);
  END;

  CREATE TRIGGER memories_fts_update AFTER UPDATE ON memories BEGIN
    INSERT INTO memories_fts(memories_fts, rowid, summary, body)
      VALUES ('delete', old.rowid, old.summary, old.body);
    INSERT INTO memories_fts(rowid, summary, body) VALUES (new.rowid, new.summary, new.body);
  END;

  -- What the file was when this index was built. One row, replaced whole — it is what lets an
  -- opening decide in a single query whether anything needs reading at all.
  CREATE TABLE memory_source (
    bytes       INTEGER NOT NULL,
    modified_at INTEGER NOT NULL
  );

  CREATE INDEX memories_state_idx  ON memories(state);
  CREATE INDEX memories_type_idx   ON memories(type);
  CREATE INDEX memory_refs_ref_idx ON memory_refs(kind, ref);
  `,
]

/**
 * What the index believes the file to be. Compared before anything is read back from it.
 *
 * A `stat` rather than a digest: hashing the file on every write would read all of it to add one
 * line. 🛑 Its blind spot, written rather than hidden — a rewrite of the SAME size within the same
 * millisecond is not seen. The file only ever grows between compactions, and a compaction changes
 * its size, so nothing the studio itself does can land there.
 */
type MemoryStamp = {
  bytes: number
  modifiedAt: number
}

export type MemoryIndex = {
  /** Adds or replaces, whichever it is — a caller never has to know which. */
  put: (memory: Memory) => void
  putAll: (memories: readonly Memory[]) => void
  /** Takes one out. The file still says it was there — this only stops it being answered. */
  remove: (id: string) => void
  read: (id: string) => Memory | null
  list: (query: MemoryQuery) => readonly Memory[]
  /** Stamps what a retrieval served, which is what later makes an unused memory age. */
  markUsed: (ids: readonly string[], at: string) => void
  stamp: () => MemoryStamp | null
  restamp: (stamp: MemoryStamp) => void
  /** Empties the tables for a rebuild. The schema stays: the file is what is authoritative. */
  clear: () => void
  close: () => void
}

const COLUMN_NAMES: readonly string[] = [
  'id',
  'type',
  'summary',
  'body',
  'importance',
  'created_at',
  'used_at',
  'source_kind',
  'source_ref',
  'state',
  'supersedes',
]

const COLUMNS = COLUMN_NAMES.join(', ')
const ALIASED = COLUMN_NAMES.map(column => `m.${column}`).join(', ')

const TYPES: readonly MemoryType[] = [
  'decision',
  'architecture',
  'feature',
  'entity',
  'script',
  'problem',
  'intent',
  'convention',
]
const STATES: readonly MemoryState[] = ['live', 'pinned', 'archived', 'dropped']
const SOURCE_KINDS: readonly MemorySourceKind[] = ['action', 'person', 'assistant', 'import']
const REF_KINDS: readonly MemoryRefKind[] = ['file', 'scene', 'node', 'asset', 'document']

function isOneOf<T extends string>(values: readonly T[], value: string): value is T {
  return (values as readonly string[]).includes(value)
}

/**
 * A row back as a memory. Every closed union is checked rather than cast: a column is a free
 * string in SQLite, and a value written by a newer studio must not become a type this one denies.
 */
function memoryOf(row: SqlRow, refs: readonly MemoryRef[], links: readonly string[]): Memory {
  const type = text(row, 'type')
  const state = text(row, 'state')
  const sourceKind = text(row, 'source_kind')
  const sourceRef = optionalText(row, 'source_ref')
  const usedAt = optionalText(row, 'used_at')
  const supersedes = optionalText(row, 'supersedes')

  return {
    id: text(row, 'id'),
    type: isOneOf(TYPES, type) ? type : 'decision',
    summary: text(row, 'summary'),
    body: text(row, 'body'),
    importance: number(row, 'importance'),
    createdAt: text(row, 'created_at'),
    ...(usedAt === undefined ? {} : { usedAt }),
    source: {
      kind: isOneOf(SOURCE_KINDS, sourceKind) ? sourceKind : 'import',
      ...(sourceRef === undefined ? {} : { ref: sourceRef }),
    },
    refs,
    links,
    state: isOneOf(STATES, state) ? state : 'live',
    ...(supersedes === undefined ? {} : { supersedes }),
  }
}

/** `?, ?, ?` for a list of values. Written out because SQLite binds no arrays. */
const holes = (count: number): string => Array.from({ length: count }, () => '?').join(', ')

const escapedLike = (wanted: string): string =>
  `%${wanted.replace(/[\\%_]/g, character => `\\${character}`)}%`

export function createMemoryIndex(driver: SqliteDriver): MemoryIndex {
  migrateTo(driver, MIGRATIONS)

  const insertMemory = driver.prepare(
    `INSERT OR REPLACE INTO memories (${COLUMNS}) VALUES (${holes(COLUMN_NAMES.length)})`,
  )
  const deleteRefs = driver.prepare('DELETE FROM memory_refs WHERE memory_id = ?')
  const deleteLinks = driver.prepare('DELETE FROM memory_links WHERE from_id = ?')
  const insertRef = driver.prepare(
    'INSERT OR IGNORE INTO memory_refs (memory_id, kind, ref) VALUES (?, ?, ?)',
  )
  const insertLink = driver.prepare(
    'INSERT OR IGNORE INTO memory_links (from_id, to_id) VALUES (?, ?)',
  )

  const write = (memory: Memory): void => {
    insertMemory.run(
      memory.id,
      memory.type,
      memory.summary,
      memory.body,
      memory.importance,
      memory.createdAt,
      memory.usedAt ?? null,
      memory.source.kind,
      memory.source.ref ?? null,
      memory.state,
      memory.supersedes ?? null,
    )
    // Replaced rather than merged: one line of the file is the whole truth about one memory, so
    // a ref dropped from it must leave the index too.
    deleteRefs.run(memory.id)
    deleteLinks.run(memory.id)
    for (const ref of memory.refs) insertRef.run(memory.id, ref.kind, ref.ref)
    for (const link of memory.links) insertLink.run(memory.id, link)
  }

  /**
   * The refs and the links of a whole page, in two queries rather than two per row: a listing of
   * a hundred memories was otherwise two hundred round trips through the driver.
   *
   * Ordered outright, and not left to the query plan: an anchor list that comes back in a
   * different order from one read to the next is a panel row that redraws for no reason.
   */
  const attach = (rows: readonly SqlRow[]): readonly Memory[] => {
    if (rows.length === 0) return []

    const ids = rows.map(row => text(row, 'id'))
    const refs = new Map<string, MemoryRef[]>()
    const links = new Map<string, string[]>()

    const refRows = driver
      .prepare(
        `SELECT memory_id, kind, ref FROM memory_refs WHERE memory_id IN (${holes(ids.length)})
         ORDER BY memory_id, kind, ref`,
      )
      .all(...ids)

    for (const row of refRows) {
      const kind = text(row, 'kind')
      if (!isOneOf(REF_KINDS, kind)) continue

      const id = text(row, 'memory_id')
      const held = refs.get(id) ?? []
      held.push({ kind, ref: text(row, 'ref') })
      refs.set(id, held)
    }

    const linkRows = driver
      .prepare(
        `SELECT from_id, to_id FROM memory_links WHERE from_id IN (${holes(ids.length)})
         ORDER BY from_id, to_id`,
      )
      .all(...ids)

    for (const row of linkRows) {
      const id = text(row, 'from_id')
      const held = links.get(id) ?? []
      held.push(text(row, 'to_id'))
      links.set(id, held)
    }

    return rows.map(row =>
      memoryOf(row, refs.get(text(row, 'id')) ?? [], links.get(text(row, 'id')) ?? []),
    )
  }

  return {
    put: memory => transaction(driver, () => write(memory)),

    putAll: memories => transaction(driver, () => memories.forEach(write)),

    remove: id => {
      // The cascade takes the refs and the links, and the fts5 trigger takes the words.
      driver.prepare('DELETE FROM memories WHERE id = ?').run(id)
    },

    read: id => {
      const row = driver.prepare(`SELECT ${COLUMNS} FROM memories WHERE id = ?`).get(id)
      return row ? (attach([row])[0] ?? null) : null
    },

    list: query => {
      const conditions: string[] = []
      const params: SqlValue[] = []

      if (query.types && query.types.length > 0) {
        conditions.push(`m.type IN (${holes(query.types.length)})`)
        params.push(...query.types)
      }

      if (query.states && query.states.length > 0) {
        conditions.push(`m.state IN (${holes(query.states.length)})`)
        params.push(...query.states)
      }

      if (query.refs && query.refs.length > 0) {
        const anchors = query.refs.map(() => '(kind = ? AND ref = ?)').join(' OR ')
        conditions.push(`m.id IN (SELECT memory_id FROM memory_refs WHERE ${anchors})`)
        for (const ref of query.refs) params.push(ref.kind, ref.ref)
      }

      const wanted = query.text?.trim() ?? ''
      const match = wanted.length > 0 ? matchExpression(wanted) : null

      if (wanted.length > 0 && match === null) {
        // Punctuation alone tokenises to nothing, and fts5 cannot look for what it never indexed
        // — searching "%" and finding "100%" is what this keeps.
        conditions.push(`(m.summary LIKE ? ESCAPE '\\' OR m.body LIKE ? ESCAPE '\\')`)
        params.push(escapedLike(wanted), escapedLike(wanted))
      }

      const filters = conditions.join(' AND ')
      const limit = query.limit ?? MEMORY_PAGE

      /**
       * Ranked by fts5 when the query has words, by weight otherwise: `rank` IS bm25, and it is
       * the one ordering that answers « which of these is about what was asked ».
       */
      const sql =
        match === null
          ? `SELECT ${ALIASED} FROM memories m ${filters ? `WHERE ${filters}` : ''}
             ORDER BY m.importance DESC, m.created_at DESC, m.id DESC LIMIT ?`
          : `SELECT ${ALIASED} FROM memories_fts f JOIN memories m ON m.rowid = f.rowid
             WHERE memories_fts MATCH ? ${filters ? `AND ${filters}` : ''}
             ORDER BY f.rank LIMIT ?`

      const bound = match === null ? [...params, limit] : [match, ...params, limit]
      return attach(driver.prepare(sql).all(...bound))
    },

    markUsed: (ids, at) => {
      if (ids.length === 0) return

      driver
        .prepare(`UPDATE memories SET used_at = ? WHERE id IN (${holes(ids.length)})`)
        .run(at, ...ids)
    },

    stamp: () => {
      const row = driver.prepare('SELECT bytes, modified_at FROM memory_source').get()
      return row ? { bytes: number(row, 'bytes'), modifiedAt: number(row, 'modified_at') } : null
    },

    restamp: ({ bytes, modifiedAt }) =>
      transaction(driver, () => {
        driver.prepare('DELETE FROM memory_source').run()
        driver
          .prepare('INSERT INTO memory_source (bytes, modified_at) VALUES (?, ?)')
          .run(bytes, modifiedAt)
      }),

    // The rows go through `memories` rather than being dropped table by table, so the fts5
    // triggers fire: an index emptied around them would keep every word it ever read.
    clear: () =>
      transaction(driver, () => {
        driver.prepare('DELETE FROM memories').run()
        driver.prepare('DELETE FROM memory_links').run()
        driver.prepare('DELETE FROM memory_source').run()
      }),

    close: () => driver.close(),
  }
}

import {
  MEMORY_PAGE,
  MEMORY_REF_KINDS,
  MEMORY_SOURCE_KINDS,
  MEMORY_STATES,
  MEMORY_TYPES,
  type Memory,
  type MemoryQuery,
  type MemoryRef,
  type MemoryRefKind,
  type MemoryType,
} from '@shared/domain/assistantMemory'
import { oneOf } from '@shared/guards'
import { askExpression, matchExpression } from '@main/project/ftsMatch'
import { chunk } from '@shared/collections'
import type { SqliteDriver, SqlRow, SqlValue } from '@main/project/sqlite'
import { migrateTo, transaction } from '@main/project/sqlMigrate'
import { escapeLike, holes } from '@main/project/sqlText'
import { bytes, number, optionalText, text } from '@main/project/sqlRow'
import {
  digestOf,
  dotOfBytes,
  embeddedTextOf,
  packed,
  type MemoryVector,
  type PendingVector,
} from './vectors'
import { rankedRecall, type RecallCandidate } from './recallScore'

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
  `
  -- What was embedded, so a rebuild does not throw every vector away. See \`digestOf\`.
  ALTER TABLE memories ADD COLUMN text_digest TEXT NOT NULL DEFAULT '';

  -- 🛑 NO foreign key, and that is the whole point: \`memories\` is emptied and rewritten every
  -- time the file is read back, and a cascade would take every embedding with it — 24 ms each,
  -- so four minutes for ten thousand of them on an opening that changed nothing. What ties a
  -- vector to a memory is the DIGEST of what was embedded; what removes an orphan is \`sweep\`.
  --
  -- 🛑 No \`vec0\` either, and that was measured before it was decided: sqlite-vec loads under
  -- \`better-sqlite3\` and answers \`no such module\` under \`node:sqlite\`, the driver the suite
  -- exercises — half the retrieval would have been untestable. Brute force over 20 000 vectors
  -- of 384 dimensions took 9 ms, so it buys nothing at this size either.
  CREATE TABLE memory_vectors (
    memory_id   TEXT PRIMARY KEY,
    text_digest TEXT NOT NULL,
    model       TEXT NOT NULL,
    vector      BLOB NOT NULL
  );

  CREATE INDEX memory_vectors_model_idx ON memory_vectors(model, text_digest);

  -- What the pending page is ordered by. [M] 10 000 memories in batches of eight: 3,53 ms a
  -- page without it, 2,24 with, and 2 ms to build.
  CREATE INDEX memories_created_idx ON memories(created_at, id);
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
export type MemoryStamp = {
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
  /** How many it holds, without reading a single one of them back. */
  count: () => number
  /**
   * The LIVE memory of this type anchored on this very reference, if one stands.
   *
   * What `supersedes` is drawn from: a rule firing twice on one script must amend what it said,
   * not leave two memories contradicting each other. 🛑 `live` alone — a pinned memory is a
   * decision to always give it, and archiving it automatically would undo that decision.
   */
  standingOn: (type: MemoryType, ref: MemoryRef) => Memory | null
  list: (query: MemoryQuery) => readonly Memory[]
  /** Stamps what a retrieval served, which is what later makes an unused memory age. */
  markUsed: (ids: readonly string[], at: string) => void
  /**
   * When each memory was last served, for the ones that ever were — what a rebuild carries over.
   *
   * 🛑 Two columns and no join. Read through `list`, an opening built one placeholder per memory
   * and threw past SQLITE_MAX_VARIABLE_NUMBER — 32 766 — which failed the whole thread, not just
   * the rebuild. It also read every summary, body, ref and link to recover one date.
   */
  served: () => ReadonlyMap<string, string>
  stamp: () => MemoryStamp | null
  restamp: (stamp: MemoryStamp) => void
  /** Empties the tables for a rebuild. The schema stays: the file is what is authoritative. */
  clear: () => void
  /** Writes what an embedder answered. One transaction whatever the batch — see `putAll`. */
  writeVectors: (vectors: readonly MemoryVector[]) => void
  /** What this model has no vector for, oldest first, with the words that make one. */
  withoutVector: (model: string, limit: number) => readonly PendingVector[]
  /** How many are still waiting — what a progress bar divides by, without reading one of them. */
  pendingVectors: (model: string) => number
  /** Forgets what another model produced. A DELETE: the memories themselves have not moved. */
  dropOtherVectors: (model: string) => void
  /**
   * What answers a question, best first — the four voices gathered and ranked here.
   *
   * 🛑 In the INDEX and not in the main process: sweeping the vectors is `[M]` 19 ms of SQL and
   * 12 ms of arithmetic at 10 000 memories, and handing them across a thread boundary to do it
   * elsewhere would clone 30 MB per question asked.
   */
  recall: (ask: RecallAsk) => readonly Memory[]
  /** Drops the vectors of memories the file no longer holds. What the end of a rebuild runs. */
  sweepVectors: () => void
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
  'text_digest',
]

const COLUMNS = COLUMN_NAMES.join(', ')
const ALIASED = COLUMN_NAMES.map(column => `m.${column}`).join(', ')

/** What a recall is given. `question` and `model` travel together: one without the other scores
 * nothing. */
export type RecallAsk = {
  text: string
  refs?: readonly MemoryRef[]
  /** The question, embedded and normalised, or nothing where no model could answer. */
  question?: Float32Array
  /** Whose vectors to compare against — a model's own space, never another's. */
  model?: string
  now: string
  limit: number
}

/** How many each voice may put forward. Ranking a hundred costs nothing; reading them does. */
const RECALL_CANDIDATES = 40

/**
 * 🛑 One placeholder per id, and SQLite takes 32 766 of them. Compaction reads every memory at
 * once, so an unbounded `IN (…)` threw past that count — which failed the whole thread, not just
 * the query. Well under, because the limit is a build option a driver may lower.
 */
const IDS_PER_QUERY = 500

/**
 * 🛑 What a recall may answer with. `archived` is absent, and that IS what archiving means: the
 * panel still lists it and the file still holds it, but the assistant stops being given it.
 * Without this a memory the person had set aside came back in the briefing beside its replacement.
 */
const ANSWERING = {
  states: ['live', 'pinned'],
  limit: RECALL_CANDIDATES,
} satisfies MemoryQuery

const byBatch = (
  ids: readonly string[],
  ask: (batch: readonly string[]) => readonly SqlRow[],
): readonly SqlRow[] => chunk([...ids], IDS_PER_QUERY).flatMap(ask)

const isRefKind = (value: string): value is MemoryRefKind =>
  MEMORY_REF_KINDS.some(kind => kind === value)

/**
 * A row back as a memory. Every closed union is checked rather than cast: a column is a free
 * string in SQLite, and a value written by a newer studio must not become a type this one denies.
 */
function memoryOf(row: SqlRow, refs: readonly MemoryRef[], links: readonly string[]): Memory {
  const sourceRef = optionalText(row, 'source_ref')
  const usedAt = optionalText(row, 'used_at')
  const supersedes = optionalText(row, 'supersedes')

  return {
    id: text(row, 'id'),
    type: oneOf(MEMORY_TYPES, text(row, 'type'), 'decision'),
    summary: text(row, 'summary'),
    body: text(row, 'body'),
    importance: number(row, 'importance'),
    createdAt: text(row, 'created_at'),
    ...(usedAt === undefined ? {} : { usedAt }),
    source: {
      kind: oneOf(MEMORY_SOURCE_KINDS, text(row, 'source_kind'), 'import'),
      ...(sourceRef === undefined ? {} : { ref: sourceRef }),
    },
    refs,
    links,
    state: oneOf(MEMORY_STATES, text(row, 'state'), 'live'),
    ...(supersedes === undefined ? {} : { supersedes }),
  }
}

export function createMemoryIndex(driver: SqliteDriver): MemoryIndex {
  migrateTo(driver, MIGRATIONS)

  const insertMemory = driver.prepare(
    `INSERT INTO memories (${COLUMNS}) VALUES (${holes(COLUMN_NAMES.length)})`,
  )
  const deleteMemory = driver.prepare('DELETE FROM memories WHERE id = ?')
  const insertRef = driver.prepare(
    'INSERT OR IGNORE INTO memory_refs (memory_id, kind, ref) VALUES (?, ?, ?)',
  )
  const insertLink = driver.prepare(
    'INSERT OR IGNORE INTO memory_links (from_id, to_id) VALUES (?, ?)',
  )
  // Held like the five above: the SQL of all of them is fixed, and `catalog.ts` draws the line
  // in the same place — only a query whose number of `?` varies is compiled per call.
  const countMemories = driver.prepare('SELECT count(*) AS held FROM memories')
  const readMemory = driver.prepare(`SELECT ${COLUMNS} FROM memories WHERE id = ?`)
  const readStamp = driver.prepare('SELECT bytes, modified_at FROM memory_source')
  const dropStamp = driver.prepare('DELETE FROM memory_source')
  const writeStamp = driver.prepare('INSERT INTO memory_source (bytes, modified_at) VALUES (?, ?)')
  const dropAll = driver.prepare('DELETE FROM memories')
  const readServed = driver.prepare('SELECT id, used_at FROM memories WHERE used_at IS NOT NULL')
  const writeVector = driver.prepare(
    `INSERT INTO memory_vectors (memory_id, text_digest, model, vector) VALUES (?, ?, ?, ?)
     ON CONFLICT(memory_id) DO UPDATE SET text_digest = excluded.text_digest,
       model = excluded.model, vector = excluded.vector`,
  )
  /**
   * 🛑 Held, unlike their many-hole siblings: `read` and `standingOn` always pass ONE id, and
   * `standingOn` runs on every `remember` — so this was a real `sqlite3_prepare_v2` per action
   * the assistant took. Only a query whose number of `?` varies is compiled per call.
   */
  const readOneRefs = driver.prepare(
    `SELECT memory_id, kind, ref FROM memory_refs WHERE memory_id = ? ORDER BY kind, ref`,
  )
  const readOneLinks = driver.prepare(
    `SELECT from_id, to_id FROM memory_links WHERE from_id = ? ORDER BY to_id`,
  )

  const countPending = driver.prepare(
    `SELECT count(*) AS held FROM memories m
     LEFT JOIN memory_vectors v
       ON v.memory_id = m.id AND v.model = ? AND v.text_digest = m.text_digest
     WHERE v.memory_id IS NULL`,
  )
  const readPending = driver.prepare(
    `SELECT m.id, m.summary, m.body, m.text_digest FROM memories m
     LEFT JOIN memory_vectors v
       ON v.memory_id = m.id AND v.model = ? AND v.text_digest = m.text_digest
     WHERE v.memory_id IS NULL ORDER BY m.created_at, m.id LIMIT ?`,
  )
  const readStanding = driver.prepare(
    `SELECT ${ALIASED} FROM memories m
     JOIN memory_refs r ON r.memory_id = m.id AND r.kind = ? AND r.ref = ?
     WHERE m.type = ? AND m.state = 'live'
     ORDER BY m.created_at DESC, m.id DESC LIMIT 1`,
  )
  const dropOther = driver.prepare('DELETE FROM memory_vectors WHERE model <> ?')
  // The blob and the id alone: building a `MemoryVector` per row cost `[M]` 78 ms at 10 000
  // against 19 for the read itself — a recall sweeps all of them.
  const sweepVectorsOf = driver.prepare(
    `SELECT v.memory_id, v.vector FROM memory_vectors v
     JOIN memories m ON m.id = v.memory_id AND m.text_digest = v.text_digest
     WHERE v.model = ?`,
  )
  const dropVector = driver.prepare('DELETE FROM memory_vectors WHERE memory_id = ?')
  const dropOrphans = driver.prepare(
    'DELETE FROM memory_vectors WHERE memory_id NOT IN (SELECT id FROM memories)',
  )

  const write = (memory: Memory): void => {
    /**
     * 🛑 Deleted then inserted, never `INSERT OR REPLACE`: a REPLACE does not fire the `AFTER
     * DELETE` trigger unless `recursive_triggers` is on, so the OLD words stayed in the fts5
     * table for ever. Measured — the replaced word still matched at its dead rowid, the corpus
     * grew by one on every amend, and `integrity-check` reported nothing. bm25 scores against a
     * corpus of ghosts. The cascade takes the refs and the links with the row.
     */
    deleteMemory.run(memory.id)
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
      digestOf(embeddedTextOf(memory.summary, memory.body)),
    )
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

    const refRows = byBatch(ids, batch =>
      batch.length === 1
        ? readOneRefs.all(...batch)
        : driver
            .prepare(
              `SELECT memory_id, kind, ref FROM memory_refs
               WHERE memory_id IN (${holes(batch.length)})
               ORDER BY memory_id, kind, ref`,
            )
            .all(...batch),
    )

    for (const row of refRows) {
      const kind = text(row, 'kind')
      if (!isRefKind(kind)) continue

      const id = text(row, 'memory_id')
      const held = refs.get(id) ?? []
      held.push({ kind, ref: text(row, 'ref') })
      refs.set(id, held)
    }

    const linkRows = byBatch(ids, batch =>
      batch.length === 1
        ? readOneLinks.all(...batch)
        : driver
            .prepare(
              `SELECT from_id, to_id FROM memory_links WHERE from_id IN (${holes(batch.length)})
               ORDER BY from_id, to_id`,
            )
            .all(...batch),
    )

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

  const listed = (query: MemoryQuery, asking = false): readonly Memory[] => {
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
    // A question is not a filter — see `askExpression`, which says what that cost.
    const match = wanted.length > 0 ? (asking ? askExpression : matchExpression)(wanted) : null

    if (wanted.length > 0 && match === null) {
      // Punctuation alone tokenises to nothing, and fts5 cannot look for what it never indexed
      // — searching "%" and finding "100%" is what this keeps.
      conditions.push(`(m.summary LIKE ? ESCAPE '\\' OR m.body LIKE ? ESCAPE '\\')`)
      params.push(`%${escapeLike(wanted)}%`, `%${escapeLike(wanted)}%`)
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
  }

  /** The ids whose vectors are closest to the question, best first, with how close they came. */
  const closestTo = (
    model: string,
    question: Float32Array,
    top: number,
  ): readonly { id: string; similarity: number }[] => {
    const scored = sweepVectorsOf.all(model).map(row => ({
      id: text(row, 'memory_id'),
      similarity: dotOfBytes(bytes(row, 'vector'), question),
    }))

    return scored.sort((one, other) => other.similarity - one.similarity).slice(0, top)
  }

  const readMany = (ids: readonly string[]): readonly Memory[] =>
    ids.length === 0
      ? []
      : attach(
          driver
            .prepare(`SELECT ${COLUMNS} FROM memories WHERE id IN (${holes(ids.length)})`)
            .all(...ids),
        )

  /**
   * The four voices, gathered into one candidate per memory. Merged rather than concatenated: a
   * memory the words AND the meaning both found must be scored once, carrying both signals.
   */
  const gathered = (ask: RecallAsk): readonly RecallCandidate[] => {
    const candidates = new Map<string, RecallCandidate>()
    const hold = (memory: Memory): RecallCandidate => {
      const held = candidates.get(memory.id) ?? { memory }
      candidates.set(memory.id, held)
      return held
    }

    // Pinned first, so what the person decided to always give is in the set whatever it scores.
    for (const memory of listed({ states: ['pinned'], limit: RECALL_CANDIDATES })) hold(memory)

    if (ask.refs && ask.refs.length > 0) {
      for (const memory of listed({ ...ANSWERING, refs: ask.refs })) hold(memory)
    }

    if (ask.text.trim().length > 0) {
      const found = listed({ ...ANSWERING, text: ask.text }, true)
      found.forEach((memory, rank) => {
        hold(memory).exactRank = rank
      })
    }

    if (ask.question && ask.question.length > 0 && ask.model) {
      const closest = closestTo(ask.model, ask.question, RECALL_CANDIDATES)
      // 🛑 ONE read, and only of what no other voice put forward: the three above already hold
      // their rows, and reading them again joins their refs and links a second time.
      const unread = readMany(closest.filter(one => !candidates.has(one.id)).map(one => one.id))
      const held = new Map(unread.map(memory => [memory.id, memory]))

      for (const one of closest) {
        const memory = candidates.get(one.id)?.memory ?? held.get(one.id)
        if (memory === undefined || memory.state === 'archived') continue
        hold(memory).similarity = one.similarity
      }
    }

    return [...candidates.values()]
  }

  const recallWith = (ask: RecallAsk): readonly Memory[] =>
    rankedRecall(gathered(ask), { ...(ask.refs && { refs: ask.refs }), now: ask.now })
      .slice(0, ask.limit)
      .map(one => one.memory)

  return {
    put: memory => transaction(driver, () => write(memory)),

    putAll: memories => transaction(driver, () => memories.forEach(write)),

    remove: id => {
      // The cascade takes the refs and the links, and the fts5 trigger takes the words. The
      // vector is NOT cascaded — see the migration — so forgetting says so itself.
      deleteMemory.run(id)
      dropVector.run(id)
    },

    count: () => number(countMemories.get() ?? {}, 'held'),

    standingOn: (type, ref) => {
      const row = readStanding.get(ref.kind, ref.ref, type)
      return row ? (attach([row])[0] ?? null) : null
    },

    read: id => {
      const row = readMemory.get(id)
      return row ? (attach([row])[0] ?? null) : null
    },

    list: listed,

    served: () => new Map(readServed.all().map(row => [text(row, 'id'), text(row, 'used_at')])),

    markUsed: (ids, at) => {
      if (ids.length === 0) return

      driver
        .prepare(`UPDATE memories SET used_at = ? WHERE id IN (${holes(ids.length)})`)
        .run(at, ...ids)
    },

    stamp: () => {
      const row = readStamp.get()
      return row ? { bytes: number(row, 'bytes'), modifiedAt: number(row, 'modified_at') } : null
    },

    restamp: ({ bytes, modifiedAt }) =>
      transaction(driver, () => {
        dropStamp.run()
        writeStamp.run(bytes, modifiedAt)
      }),

    // Through `memories` alone: the fts5 triggers fire on the delete, and the cascade takes the
    // refs and the links. An index emptied table by table would keep every word it ever read.
    clear: () =>
      transaction(driver, () => {
        dropAll.run()
        dropStamp.run()
      }),

    writeVectors: vectors =>
      transaction(driver, () => {
        for (const one of vectors) {
          writeVector.run(one.memoryId, one.digest, one.model, packed(one.values))
        }
      }),

    withoutVector: (model, limit) =>
      readPending.all(model, limit).map(row => ({
        id: text(row, 'id'),
        text: embeddedTextOf(text(row, 'summary'), text(row, 'body')),
        // Read rather than recomputed: the column is what the join compares, so hashing the two
        // halves a second time here is one more chance for the two answers to disagree.
        digest: text(row, 'text_digest'),
      })),

    pendingVectors: model => number(countPending.get(model) ?? {}, 'held'),

    dropOtherVectors: model => {
      dropOther.run(model)
    },

    recall: recallWith,

    // Run after a rebuild, never during one: `clear` deliberately spares the vectors, so what a
    // file no longer holds is only known once the file has been read back whole.
    sweepVectors: () => {
      dropOrphans.run()
    },

    close: () => driver.close(),
  }
}

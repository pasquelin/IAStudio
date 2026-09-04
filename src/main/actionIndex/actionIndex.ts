import type { ActionName } from '@shared/domain/assistant'
import { askExpression } from '@main/project/ftsMatch'
import { migrateTo, transaction } from '@main/project/sqlMigrate'
import { bytes, number, optionalNumber, optionalText } from '@main/project/sqlRow'
import type { SqlRow, SqliteDriver } from '@main/project/sqlite'
import { dotOfBytes, normalised, packed } from '@main/memory/vectors'
import type { ActionCorpus, IndexedAction } from './actionCorpus'
import { ACTION_INDEX_MIGRATIONS } from './actionIndexSchema'

const DEFAULT_LIMIT = 5
const MAX_LIMIT = 12
const FTS_CANDIDATES = 40

export type ActionEmbedding = {
  name: ActionName
  model: string
  values: Float32Array
}

export type ActionSearch = {
  query: string
  limit?: number
  embedding?: { model: string; values: Float32Array }
}

export type ActionHit = {
  action: IndexedAction
  score: number
  lexicalScore: number
  semanticScore?: number
}

export type ActionRebuild = {
  rebuilt: boolean
  count: number
  fingerprint: string
}

export type ActionIndex = {
  rebuild: (corpus: ActionCorpus) => ActionRebuild
  writeEmbeddings: (embeddings: readonly ActionEmbedding[]) => void
  search: (search: ActionSearch) => readonly ActionHit[]
  fingerprint: () => string | null
  embeddingModel: () => string | null
  count: () => number
  close: () => void
}

function actionOf(row: SqlRow): IndexedAction | null {
  const descriptor = optionalText(row, 'descriptor')
  if (!descriptor) return null
  try {
    const parsed: unknown = JSON.parse(descriptor)
    if (typeof parsed !== 'object' || parsed === null || !('name' in parsed)) return null
    // The database is derived exclusively from `ActionCorpus`; malformed external rows are rejected above.
    return parsed as IndexedAction
  } catch {
    return null
  }
}

function lexicalScore(query: string, action: IndexedAction, rank?: number): number {
  const wanted = query.toLocaleLowerCase('en').trim()
  const name = action.name.toLocaleLowerCase('en')
  const tokens = wanted.match(/[\p{L}\p{N}_]+/gu) ?? []
  const nameTokens = name.split(/[.:]/)
  let score = rank === undefined ? 0 : 1 / (1 + Math.exp(rank))
  if (name === wanted) score += 12
  else if (name.startsWith(wanted)) score += 7
  if (nameTokens.some(token => token === wanted)) score += 4
  if (action.family === wanted) score += 2
  for (const token of tokens) {
    if (nameTokens.some(nameToken => nameToken.startsWith(token))) score += 1.5
    if (action.title.toLocaleLowerCase('en').includes(token)) score += 0.75
  }
  return score
}

export function createActionIndex(driver: SqliteDriver): ActionIndex {
  migrateTo(driver, ACTION_INDEX_MIGRATIONS)

  const fingerprint = (): string | null => {
    const row = driver
      .prepare("SELECT value FROM action_index_metadata WHERE key = 'fingerprint'")
      .get()
    return row ? (optionalText(row, 'value') ?? null) : null
  }

  const rebuild = (corpus: ActionCorpus): ActionRebuild => {
    if (fingerprint() === corpus.fingerprint) {
      return { rebuilt: false, count: corpus.actions.length, fingerprint: corpus.fingerprint }
    }
    transaction(driver, () => {
      driver.prepare('DELETE FROM indexed_actions').run()
      driver.prepare("DELETE FROM action_index_metadata WHERE key = 'embedding_model'").run()
      const insert = driver.prepare(
        `INSERT INTO indexed_actions
         (name, family, title, description, searchable, descriptor, ordinal)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      const insertField = driver.prepare(
        `INSERT INTO action_fields
         (action_name, ordinal, key, kind, label, required, options, picks, minimum, maximum, repeated)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      for (const action of corpus.actions) {
        insert.run(
          action.name,
          action.family,
          action.title,
          action.description,
          action.searchable,
          JSON.stringify(action),
          action.ordinal,
        )
        action.fields.forEach((field, ordinal) =>
          insertField.run(
            action.name,
            ordinal,
            field.key,
            field.kind,
            field.labelKey,
            field.required ? 1 : 0,
            field.options ? JSON.stringify(field.options) : null,
            field.picks ?? null,
            field.min ?? null,
            field.max ?? null,
            field.repeated ? 1 : 0,
          ),
        )
      }
      driver
        .prepare(
          `INSERT INTO action_index_metadata(key, value) VALUES ('fingerprint', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        )
        .run(corpus.fingerprint)
    })
    return { rebuilt: true, count: corpus.actions.length, fingerprint: corpus.fingerprint }
  }

  const writeEmbeddings = (embeddings: readonly ActionEmbedding[]): void => {
    transaction(driver, () => {
      const update = driver.prepare(
        `INSERT INTO action_vectors(action_name, model, embedding) VALUES (?, ?, ?)
         ON CONFLICT(action_name) DO UPDATE SET model = excluded.model, embedding = excluded.embedding`,
      )
      for (const embedding of embeddings) {
        update.run(embedding.name, embedding.model, packed(normalised(embedding.values)))
      }
      const model = embeddings[0]?.model
      if (model)
        driver
          .prepare(
            `INSERT INTO action_index_metadata(key, value) VALUES ('embedding_model', ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
          )
          .run(model)
    })
  }

  const search = (wanted: ActionSearch): readonly ActionHit[] => {
    const expression = askExpression(wanted.query)
    if (expression === null) return []
    const lexicalRows = driver
      .prepare(
        `SELECT a.descriptor, v.embedding, v.model AS embedding_model, a.ordinal,
                bm25(indexed_actions_fts) AS rank
         FROM indexed_actions_fts f JOIN indexed_actions a ON a.rowid = f.rowid
         LEFT JOIN action_vectors v ON v.action_name = a.name
         WHERE indexed_actions_fts MATCH ? AND a.name <> 'actions.find'
         ORDER BY rank, a.ordinal LIMIT ?`,
      )
      .all(expression, FTS_CANDIDATES)
    const semanticRows = wanted.embedding
      ? driver
          .prepare(
            `SELECT a.descriptor, v.embedding, v.model AS embedding_model, a.ordinal, NULL AS rank
             FROM indexed_actions a JOIN action_vectors v ON v.action_name = a.name
             WHERE a.name <> 'actions.find' AND v.model = ?`,
          )
          .all(wanted.embedding.model)
      : []
    const rows = new Map(
      [...semanticRows, ...lexicalRows].map(row => [optionalText(row, 'descriptor') ?? '', row]),
    ).values()
    const question = wanted.embedding ? normalised(wanted.embedding.values) : null
    const hits = [...rows].flatMap(row => {
      const action = actionOf(row)
      if (!action) return []
      const lexical = lexicalScore(wanted.query, action, optionalNumber(row, 'rank'))
      const model = optionalText(row, 'embedding_model')
      const semantic =
        question && model === wanted.embedding?.model
          ? dotOfBytes(bytes(row, 'embedding'), question)
          : undefined
      return [
        {
          action,
          lexicalScore: lexical,
          ...(semantic === undefined ? {} : { semanticScore: semantic }),
          score: lexical + Math.max(0, semantic ?? 0) * 3,
        },
      ]
    })
    const limit = Math.max(1, Math.min(MAX_LIMIT, Math.floor(wanted.limit ?? DEFAULT_LIMIT)))
    return hits
      .sort((left, right) => right.score - left.score || left.action.ordinal - right.action.ordinal)
      .slice(0, limit)
  }

  return {
    rebuild,
    writeEmbeddings,
    search,
    fingerprint,
    embeddingModel: () => {
      const row = driver
        .prepare("SELECT value FROM action_index_metadata WHERE key = 'embedding_model'")
        .get()
      return row ? (optionalText(row, 'value') ?? null) : null
    },
    count: () => {
      const row = driver.prepare('SELECT count(*) AS count FROM indexed_actions').get()
      return row ? number(row, 'count') : 0
    },
    close: () => driver.close(),
  }
}

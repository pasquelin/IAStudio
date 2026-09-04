import type { ActionName } from '@shared/domain/assistant'
import type { ActionResource } from '@shared/domain/actionResource'
import { isDocumentKind } from '@shared/domain/document'
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
  available?: readonly ActionResource[]
  scope?: { target?: string; document?: string }
}

export type ActionHit = {
  action: IndexedAction
  score: number
  lexicalScore: number
  semanticScore?: number
  workflowScore?: number
  scopeScore?: number
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

const folded = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en')

const wordsOf = (value: string): readonly string[] => folded(value).match(/[\p{L}\p{N}_]+/gu) ?? []

function lexicalScore(query: string, action: IndexedAction, rank?: number): number {
  const wanted = folded(query).trim()
  const name = action.name.toLocaleLowerCase('en')
  const tokens = wordsOf(wanted)
  const nameTokens = name.split(/[.:]/)
  const searchableTokens = wordsOf(action.searchable)
  const titleTokens = action.localizedTitles.flatMap(wordsOf)
  const fieldTokens = action.localizedFieldLabels.flatMap(wordsOf)
  let score = rank === undefined ? 0 : 1 / (1 + Math.exp(rank))
  if (name === wanted) score += 12
  else if (name.startsWith(wanted)) score += 7
  if (nameTokens.some(token => token === wanted)) score += 4
  if (action.family === wanted) score += 2
  for (const token of tokens)
    score += tokenScore(token, action.title, nameTokens, searchableTokens, titleTokens, fieldTokens)
  return score
}

function tokenScore(
  token: string,
  title: string,
  nameTokens: readonly string[],
  searchableTokens: readonly string[],
  titleTokens: readonly string[],
  fieldTokens: readonly string[],
): number {
  let score = nameTokens.some(nameToken => nameToken.startsWith(token)) ? 1.5 : 0
  if (title.toLocaleLowerCase('en').includes(token)) score += 0.75
  if (token.length < 4) return score
  const prefix = token.slice(0, 4)
  if (searchableTokens.some(candidate => candidate.startsWith(prefix))) score += 0.5
  if (titleTokens.some(candidate => candidate.startsWith(prefix))) score += 2
  if (fieldTokens.some(candidate => candidate.startsWith(prefix))) score += 1.5
  return score
}

function actionScopeScore(action: IndexedAction, scope: ActionSearch['scope']): number {
  const target = scope?.target?.toLocaleLowerCase('en')
  const document = scope?.document?.toLocaleLowerCase('en')
  const targetsSelection =
    target !== undefined &&
    action.fields.some(
      field => field.picks === target || field.key.toLocaleLowerCase('en') === `${target}id`,
    )
  const documentScore =
    document !== undefined && isDocumentKind(action.family)
      ? action.family === document
        ? 2
        : -2
      : 0
  return Number(targetsSelection) * 4 + documentScore
}

function workflowScoresOf(
  hits: readonly ActionHit[],
  availableResources: readonly ActionResource[],
): ReadonlyMap<ActionName, number> {
  const available = new Set(availableResources)
  const scores = new Map<ActionName, number>()
  const ranked = hits
    .filter(hit => hit.score >= 1)
    .sort((left, right) => right.score - left.score || left.action.ordinal - right.action.ordinal)
  const producers = (resource: ActionResource): readonly IndexedAction[] =>
    hits
      .map(hit => hit.action)
      .filter(action => action.produces.includes(resource) || action.returns.includes(resource))
  const visit = (
    action: IndexedAction,
    score: number,
    visited: ReadonlySet<ActionResource>,
  ): void => {
    for (const resource of [...action.requires, ...action.inputs]) {
      if (available.has(resource) || visited.has(resource)) continue
      const nextVisited = new Set(visited).add(resource)
      for (const producer of producers(resource)) {
        scores.set(producer.name, Math.max(scores.get(producer.name) ?? 0, score))
        visit(producer, Math.max(1, score - 1), nextVisited)
      }
    }
  }
  for (const hit of ranked.slice(0, 3)) visit(hit.action, 6, new Set())
  for (const resource of available) {
    for (const hit of ranked.filter(
      candidate =>
        candidate.action.requires.includes(resource) || candidate.action.inputs.includes(resource),
    ))
      scores.set(hit.action.name, Math.max(scores.get(hit.action.name) ?? 0, 4))
  }
  return scores
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
    const fallbackRows = driver
      .prepare(
        `SELECT a.descriptor, v.embedding, v.model AS embedding_model, a.ordinal, NULL AS rank
         FROM indexed_actions a LEFT JOIN action_vectors v ON v.action_name = a.name
         WHERE a.name <> 'actions.find'`,
      )
      .all()
    const rows = new Map(
      [...fallbackRows, ...semanticRows, ...lexicalRows].map(row => [
        optionalText(row, 'descriptor') ?? '',
        row,
      ]),
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
      const scopeScore = actionScopeScore(action, wanted.scope)
      return [
        {
          action,
          lexicalScore: lexical,
          ...(scopeScore === 0 ? {} : { scopeScore }),
          ...(semantic === undefined ? {} : { semanticScore: semantic }),
          score: lexical + Math.max(0, semantic ?? 0) * 3 + scopeScore,
        },
      ]
    })
    const workflowScores = workflowScoresOf(hits, wanted.available ?? [])
    const limit = Math.max(1, Math.min(MAX_LIMIT, Math.floor(wanted.limit ?? DEFAULT_LIMIT)))
    return hits
      .map(hit => {
        const workflowScore = workflowScores.get(hit.action.name) ?? 0
        return workflowScore === 0
          ? hit
          : { ...hit, workflowScore, score: hit.score + workflowScore }
      })
      .filter(hit => hit.score >= 1)
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

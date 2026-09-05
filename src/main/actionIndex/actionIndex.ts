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
import {
  actionBm25Score,
  actionIntentScore,
  actionLexicalScore,
  actionSearchWords,
} from './actionLexical'

const DEFAULT_LIMIT = 5
const MAX_LIMIT = 12
const FTS_CANDIDATES = 40
const AVAILABLE_RESOURCE_SCORE = 8
const RRF_K = 60
const FTS_RRF_WEIGHT = 2

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
  bm25Score?: number
  semanticScore?: number
  workflowScore?: number
  resourceScore?: number
  scopeScore?: number
  compatibilityScore?: number
  intentScore?: number
  fusionScore?: number
}

export type ActionRanking = ActionHit & {
  rank: number
  included: boolean
  exclusion?: 'belowMinimumScore' | 'outsideLimit' | 'reservedDiscoveryAction'
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
  inspect: (search: ActionSearch) => readonly ActionRanking[]
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

function actionScopeScores(
  action: IndexedAction,
  scope: ActionSearch['scope'],
): { scope: number; compatibility: number } {
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
        : -4
      : 0
  return { scope: documentScore, compatibility: Number(targetsSelection) * 4 }
}

function workflowScoresOf(
  hits: readonly ActionHit[],
  availableResources: readonly ActionResource[],
): { workflow: ReadonlyMap<ActionName, number>; resources: ReadonlyMap<ActionName, number> } {
  const available = new Set(availableResources)
  const scores = new Map<ActionName, number>()
  const resources = new Map<ActionName, number>()
  const ranked = hits
    .filter(hit => hit.lexicalScore >= 1 && (hit.intentScore ?? 0) > 0)
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
  for (const hit of ranked) {
    for (const resource of [...hit.action.produces, ...hit.action.returns]) {
      for (const consumer of hits.filter(
        candidate =>
          candidate.action.requires.includes(resource) ||
          candidate.action.inputs.includes(resource),
      )) {
        scores.set(consumer.action.name, Math.max(scores.get(consumer.action.name) ?? 0, 3))
        visit(consumer.action, 6, new Set())
      }
    }
  }
  for (const resource of available) {
    for (const hit of hits.filter(
      candidate =>
        candidate.action.requires.includes(resource) || candidate.action.inputs.includes(resource),
    ))
      resources.set(
        hit.action.name,
        Math.max(resources.get(hit.action.name) ?? 0, AVAILABLE_RESOURCE_SCORE),
      )
  }
  return { workflow: scores, resources }
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

  const inspect = (wanted: ActionSearch): readonly ActionRanking[] => {
    const expression = askExpression(actionSearchWords(wanted.query).join(' '))
    const lexicalRows =
      expression === null
        ? []
        : driver
            .prepare(
              `SELECT a.descriptor, v.embedding, v.model AS embedding_model, a.ordinal,
                bm25(indexed_actions_fts) AS rank
         FROM indexed_actions_fts f JOIN indexed_actions a ON a.rowid = f.rowid
         LEFT JOIN action_vectors v ON v.action_name = a.name
         WHERE indexed_actions_fts MATCH ?
         ORDER BY rank, a.ordinal LIMIT ?`,
            )
            .all(expression, FTS_CANDIDATES)
    const semanticRows = wanted.embedding
      ? driver
          .prepare(
            `SELECT a.descriptor, v.embedding, v.model AS embedding_model, a.ordinal, NULL AS rank
             FROM indexed_actions a JOIN action_vectors v ON v.action_name = a.name
             WHERE v.model = ?`,
          )
          .all(wanted.embedding.model)
      : []
    const fallbackRows = driver
      .prepare(
        `SELECT a.descriptor, v.embedding, v.model AS embedding_model, a.ordinal, NULL AS rank
         FROM indexed_actions a LEFT JOIN action_vectors v ON v.action_name = a.name
         `,
      )
      .all()
    const rows = new Map(
      [...fallbackRows, ...semanticRows, ...lexicalRows].map(row => [
        optionalText(row, 'descriptor') ?? '',
        row,
      ]),
    ).values()
    const indexedRows = [...rows].flatMap(row => {
      const action = actionOf(row)
      return action ? [{ action, row }] : []
    })
    const ftsRanks = new Map(
      lexicalRows.flatMap((row, index) => {
        const action = actionOf(row)
        return action ? [[action.name, index + 1]] : []
      }),
    )
    const question = wanted.embedding ? normalised(wanted.embedding.values) : null
    const hits = indexedRows.map(({ action, row }) => {
      const rank = optionalNumber(row, 'rank')
      const lexical = actionLexicalScore(wanted.query, action, rank)
      const model = optionalText(row, 'embedding_model')
      const semantic =
        question && model === wanted.embedding?.model
          ? dotOfBytes(bytes(row, 'embedding'), question)
          : undefined
      const scope = actionScopeScores(action, wanted.scope)
      const totalScopeScore = scope.scope + scope.compatibility
      const intentScore = actionIntentScore(wanted.query, action)
      const ftsRank = ftsRanks.get(action.name)
      const fusionScore =
        ftsRank === undefined || scope.scope < 0 ? 0 : FTS_RRF_WEIGHT * (RRF_K / (RRF_K + ftsRank))
      return {
        action,
        lexicalScore: lexical,
        ...(rank === undefined ? {} : { bm25Score: actionBm25Score(rank) }),
        ...(scope.scope === 0 ? {} : { scopeScore: scope.scope }),
        ...(scope.compatibility === 0 ? {} : { compatibilityScore: scope.compatibility }),
        ...(semantic === undefined ? {} : { semanticScore: semantic }),
        ...(intentScore === 0 ? {} : { intentScore }),
        ...(fusionScore === 0 ? {} : { fusionScore }),
        score:
          lexical + Math.max(0, semantic ?? 0) * 3 + totalScopeScore + intentScore + fusionScore,
      }
    })
    const signals = workflowScoresOf(hits, wanted.available ?? [])
    const limit = Math.max(1, Math.min(MAX_LIMIT, Math.floor(wanted.limit ?? DEFAULT_LIMIT)))
    const ranked = hits
      .map(hit => {
        const workflowScore = signals.workflow.get(hit.action.name) ?? 0
        const resourceScore = signals.resources.get(hit.action.name) ?? 0
        return {
          ...hit,
          ...(workflowScore === 0 ? {} : { workflowScore }),
          ...(resourceScore === 0 ? {} : { resourceScore }),
          score: hit.score + workflowScore + resourceScore,
        }
      })
      .sort((left, right) => right.score - left.score || left.action.ordinal - right.action.ordinal)
    let visibleRank = 0
    return ranked.map(hit => {
      const reserved = hit.action.name === 'actions.find'
      if (!reserved) visibleRank += 1
      const included = !reserved && hit.score >= 1 && visibleRank <= limit
      const exclusion = reserved
        ? 'reservedDiscoveryAction'
        : hit.score < 1
          ? 'belowMinimumScore'
          : visibleRank > limit
            ? 'outsideLimit'
            : undefined
      return {
        ...hit,
        rank: reserved ? ranked.length : visibleRank,
        included,
        ...(exclusion ? { exclusion } : {}),
      }
    })
  }

  const search = (wanted: ActionSearch): readonly ActionHit[] =>
    askExpression(wanted.query) === null
      ? []
      : inspect(wanted)
          .filter(hit => hit.included)
          .map(({ rank: _rank, included: _included, exclusion: _exclusion, ...hit }) => hit)

  return {
    rebuild,
    writeEmbeddings,
    search,
    inspect,
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

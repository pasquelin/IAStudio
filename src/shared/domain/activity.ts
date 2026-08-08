/**
 * What the studio did, and what it failed to do — kept rather than printed.
 *
 * The studio had no error surface: a job that failed, an import that never landed, a write the
 * disk refused, all went to the main process's terminal and nowhere else. A user saw an asset
 * that never appeared and had nothing to read.
 *
 * Two rules make the journal survive the things that would otherwise rot it:
 *
 * A line stores a KEY and its parameters, never a sentence. A sentence written in French into
 * a database is French for ever, and reads as gibberish the day the interface is in English.
 *
 * `detail` carries `describeFailure` and nothing else. An SDK error message embeds the request
 * that produced it, so it carries the `Authorization` header, so it carries the API key — see
 * `scenario/client.ts`. A journal is a file on disk that a user may well send to someone.
 */
export type ActivityLevel = 'info' | 'warn' | 'error'

export const ACTIVITY_LEVELS: readonly ActivityLevel[] = ['info', 'warn', 'error']

/** What a line is about, so the panel can be read by subject rather than only by time. */
export type ActivityTopic = 'generation' | 'import' | 'library' | 'document'

export const ACTIVITY_TOPICS: readonly ActivityTopic[] = [
  'generation',
  'import',
  'library',
  'document',
]

/**
 * The values a message key interpolates. Strings and numbers only: what goes in has to survive
 * a round trip through JSON and come back meaning the same thing.
 */
export type ActivityParams = Record<string, string | number>

/** A line as it is written. The catalogue assigns the id, the caller stamps the time. */
export type ActivityDraft = {
  at: string
  level: ActivityLevel
  topic: ActivityTopic
  /** An i18n key — `activity.jobFailed`, never "La génération a échoué". */
  messageKey: string
  params?: ActivityParams
  /** `describeFailure()` only. Never `error.message`. */
  detail?: string
  /** What the line is about, when it is about one asset. */
  assetId?: string
}

/** A line as it is read back. */
export type ActivityEntry = ActivityDraft & { id: number }

/** What the panel asks for. Empty lists mean "no filter", not "nothing". */
export type ActivityQuery = {
  levels?: readonly ActivityLevel[]
  topics?: readonly ActivityTopic[]
  /** Newest first, so a bare read is what the panel opens on. */
  limit?: number
}

export function isActivityLevel(value: unknown): value is ActivityLevel {
  return ACTIVITY_LEVELS.some(candidate => candidate === value)
}

export function isActivityTopic(value: unknown): value is ActivityTopic {
  return ACTIVITY_TOPICS.some(candidate => candidate === value)
}

/**
 * How many lines a project keeps.
 *
 * A bound rather than none: the journal is append-only and written by everything, so an import
 * of a thousand files would otherwise grow it for ever. Old lines are the ones nobody reads —
 * what a user looks for is what just went wrong.
 */
export const ACTIVITY_RETENTION = 2000

/**
 * How long lines are gathered before the windows hear about them.
 *
 * Pushing two hundred assets writes two hundred lines; one IPC message each would flood the
 * boundary the ingest bar already learned not to. The delay is short enough that a failure
 * still feels immediate.
 */
export const ACTIVITY_FLUSH_MS = 200

/**
 * Whether a line passes a filter. Shared so the panel and the catalogue cannot come to disagree
 * about what "no filter" means — an absent list and an empty one both let everything through.
 */
export function matchesActivity(entry: ActivityDraft, query: ActivityQuery): boolean {
  const levels = query.levels ?? []
  const topics = query.topics ?? []

  return (
    (levels.length === 0 || levels.includes(entry.level)) &&
    (topics.length === 0 || topics.includes(entry.topic))
  )
}

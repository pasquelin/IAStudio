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

/**
 * What a line is about, so the panel can be read by subject rather than only by time.
 *
 * `shell` is the application itself rather than anything it holds: every window loads the one
 * bundle and renders through the one root, so a render that threw in the preferences would read
 * as a document's failure under any other topic.
 */
export type ActivityTopic = 'generation' | 'import' | 'library' | 'document' | 'project' | 'shell'

export const ACTIVITY_TOPICS: readonly ActivityTopic[] = [
  'generation',
  'import',
  'library',
  'document',
  'project',
  'shell',
]

/**
 * Every line the main process can write, by name.
 *
 * Written out rather than left as `string`, and it is the only chance there is: the window draws
 * a line with `t(entry.messageKey)`, a call whose key is a variable — `known-keys.i18n.test.ts`
 * cannot resolve it, and its glob stops at the renderer anyway. A misspelt key here read as
 * itself on screen, and nothing in the repository could have said so.
 */
export type ActivityMessage =
  | 'apiRefused'
  | 'captionFailed'
  | 'captioned'
  | 'fileNotMoved'
  | 'fileNotOpened'
  | 'fileNotRenamed'
  | 'fileNotTrashed'
  | 'generated'
  | 'generatedInto'
  | 'importFailed'
  | 'importUnreadable'
  | 'imported'
  | 'jobCancelled'
  | 'jobFailed'
  | 'projectNotAProject'
  | 'projectNotCreated'
  | 'projectTooNew'
  | 'projectUnreadable'
  | 'pullFailed'
  | 'pulled'
  | 'pushFailed'
  | 'pushed'
  | 'tagsNotSynced'
  | 'unknownMessage'

export const ACTIVITY_MESSAGES: readonly ActivityMessage[] = [
  'apiRefused',
  'captionFailed',
  'captioned',
  'fileNotMoved',
  'fileNotOpened',
  'fileNotRenamed',
  'fileNotTrashed',
  'generated',
  'generatedInto',
  'importFailed',
  'importUnreadable',
  'imported',
  'jobCancelled',
  'jobFailed',
  'projectNotAProject',
  'projectNotCreated',
  'projectTooNew',
  'projectUnreadable',
  'pullFailed',
  'pulled',
  'pushFailed',
  'pushed',
  'tagsNotSynced',
  'unknownMessage',
]

/**
 * The key as it is stored and as the window looks it up.
 *
 * Log scopes are the one family left open. They are composed from `LOG_SCOPES`, which lives in
 * `ipc.ts` — a module that imports this one, so naming the type here would close a cycle. The
 * family is guarded all the same, by `DYNAMIC_KEYS`, and its one site composes from `LogScope`.
 */
export type ActivityMessageKey = `activity.${ActivityMessage}` | `activity.scope.${string}`

/**
 * A line read back from the catalogue names a key that was written by whatever version wrote it,
 * so a renamed key comes back naming nothing. Checked like `level` and `topic` beside it.
 */
export function isActivityMessageKey(value: unknown): value is ActivityMessageKey {
  return ACTIVITY_MESSAGES.some(name => `activity.${name}` === value)
}

/**
 * The values a message key interpolates. Strings, numbers, and lists of ids — what goes in has
 * to survive a round trip through JSON and come back meaning the same thing.
 *
 * A list is ids, never names: a line is read back long after it was written, and a name would
 * freeze at the language of the day. The window turns them into words when it draws the line.
 */
export type ActivityParams = Record<string, string | number | readonly string[]>

/** A line as it is written. The catalogue assigns the id, the caller stamps the time. */
export type ActivityDraft = {
  at: string
  level: ActivityLevel
  topic: ActivityTopic
  /** An i18n key — `activity.jobFailed`, never "La génération a échoué". */
  messageKey: ActivityMessageKey
  params?: ActivityParams
  /** `describeFailure()` only. Never `error.message`. */
  detail?: string
  /** What the line is about, when it is about one asset. */
  assetId?: string
}

/** A line as it is read back. */
export type ActivityEntry = ActivityDraft & { id: number }

/**
 * What crosses the boundary. Only a count: the window holds the lines it was given and filters
 * them itself, so a filter costs no round trip — and the toasts still see a failure the current
 * filter would have hidden.
 */
export type ActivityQuery = { limit?: number }

/** What the panel narrows by. Empty lists mean "no filter", not "nothing". */
export type ActivityFilter = {
  levels?: readonly ActivityLevel[]
  topics?: readonly ActivityTopic[]
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
 * How many of those a window holds.
 *
 * Wider than a screenful — the panel shows about fifteen — and far short of the retention: the
 * whole two thousand is half a megabyte deserialised on a UI thread that draws none of it.
 *
 * The same bound on both sides of a window's life, the read and the lines that arrive after:
 * a failure count computed over two hundred rows at one moment and two thousand at another is
 * a count that seems to lose failures on its own.
 */
export const ACTIVITY_WINDOW = 200

/** Whether a line passes a filter. An absent list and an empty one both let everything through. */
export function matchesActivity(entry: ActivityDraft, filter: ActivityFilter): boolean {
  const levels = filter.levels ?? []
  const topics = filter.topics ?? []

  return (
    (levels.length === 0 || levels.includes(entry.level)) &&
    (topics.length === 0 || topics.includes(entry.topic))
  )
}

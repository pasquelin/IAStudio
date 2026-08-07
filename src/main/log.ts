import type { LogVerbosity } from '@shared/domain/settings'
import type { LogEntry, LogLevel } from '@shared/ipc'

/**
 * The main process's own log. It prints to the terminal running the app AND, once a sink is
 * installed, mirrors to every renderer's devtools console.
 *
 * The mirror is the point: the API calls leave from the main process, so they never appear in
 * the renderer's Network tab, and every failure crossing the boundary is reduced to a code —
 * an SDK error message embeds the request that produced it, so it carries the API key and can
 * never reach the renderer. That reduction leaves "unexpected" as the only thing a user sees;
 * this is where the rest of the story stays.
 *
 * Never log a whole SDK error: log its status and its parsed body, which the credentials never
 * travel in — see `describeFailure`.
 */
type Sink = (entry: LogEntry) => void

let sink: Sink | null = null

/** Installed once the windows exist; before that the terminal is the only output. */
export function mirrorLogsTo(destination: Sink | null): void {
  sink = destination
}

const quiet = process.env['NODE_ENV'] === 'test'

/**
 * How loud each level is. A line is written when its rank is at or below the threshold, so the
 * setting is a comparison rather than a table of what each level lets through.
 */
const RANK: Record<LogLevel, number> = { error: 1, warn: 2, info: 3 }

const RANK_OF_VERBOSITY: Record<LogVerbosity, number> = { silent: 0, error: 1, warn: 2, info: 3 }

let threshold = RANK_OF_VERBOSITY.info

/** Set from the settings, and again whenever they change. */
export function setLogVerbosity(verbosity: LogVerbosity): void {
  threshold = RANK_OF_VERBOSITY[verbosity]
}

function write(level: LogLevel, scope: string, message: string): void {
  if (quiet || RANK[level] > threshold) return

  const line = `[${scope}] ${message}`

  /* eslint-disable no-console -- this module IS the main process's logger */
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
  /* eslint-enable no-console */

  sink?.({ level, scope, message })
}

export const log = {
  info: (scope: string, message: string) => write('info', scope, message),
  warn: (scope: string, message: string) => write('warn', scope, message),
  error: (scope: string, message: string) => write('error', scope, message),
}

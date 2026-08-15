import { z } from 'zod'
import { LOG_LEVELS, LOG_SCOPES, MAX_LOG_MESSAGE, type LogEntry, type LogScope } from '@shared/ipc'

/**
 * Strict on what names the line, forgiving on the line itself: a level or a scope outside the
 * shared lists can only come from something that is not this application's code, while an
 * over-long message is ordinary — a loader's error text carries the whole URL it failed on.
 * Rejecting that would make the channel meant to end silent failures fail silently.
 */
const logEntry = z.object({
  level: z.enum(LOG_LEVELS),
  scope: z.enum(LOG_SCOPES),
  message: z
    .string()
    .trim()
    .min(1)
    .transform(value => value.slice(0, MAX_LOG_MESSAGE)),
})

/**
 * `LogEntry.scope` is a free string — the main process logs under its own names too. Returning
 * that wider type threw away what the schema had just established, leaving the caller a runtime
 * guard no input could reach.
 */
export type ParsedLogEntry = Omit<LogEntry, 'scope'> & { scope: LogScope }

export function parseLogEntry(value: unknown): ParsedLogEntry {
  return logEntry.parse(value)
}

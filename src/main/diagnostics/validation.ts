import { z } from 'zod'
import { LOG_LEVELS, LOG_SCOPES, MAX_LOG_MESSAGE, type LogEntry } from '@shared/ipc'

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

export function parseLogEntry(value: unknown): LogEntry {
  return logEntry.parse(value)
}

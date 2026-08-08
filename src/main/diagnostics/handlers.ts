import { CHANNELS } from '@shared/ipc'
import { handle } from '@main/ipc/handle'
import { log } from '@main/log'
import { parseLogEntry } from './validation'

/**
 * The renderer's own failures, recorded where the log lives. Without this channel they have
 * nowhere to go: `console.error` in a component leaves nothing behind in a packaged build, and
 * the studio has no error surface yet — a 3D model that fails to load is simply absent.
 */
export function registerDiagnosticsHandlers(): void {
  handle(CHANNELS.diagnosticsReport, (_event, entry) => {
    const { level, scope, message } = parseLogEntry(entry)
    // Prefixed here rather than sent prefixed, so a line can never claim to come from this side.
    log[level](`renderer/${scope}`, message)
  })
}

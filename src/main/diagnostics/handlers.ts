import { CHANNELS, isLogScope, type LogScope } from '@shared/ipc'
import type { ActivityTopic } from '@shared/domain/activity'
import { handle } from '@main/ipc/handle'
import { log } from '@main/log'
import type { ActivityLog } from '@main/project/activity-log'
import { parseLogEntry } from './validation'

/**
 * Which part of the journal a renderer scope belongs to. A closed union on both sides, so a
 * ninth scope cannot be added without deciding where its failures are read.
 */
const TOPIC_OF_SCOPE: Record<LogScope, ActivityTopic> = {
  'scene.model': 'document',
  'scene.texture': 'document',
  'scene.export': 'document',
  'texture.map': 'document',
  'texture.channel': 'document',
  // A chunk three renamed upstream, so a material setting silently stopped applying. Read with
  // the document because that is where it shows — as a slider that moves nothing.
  'texture.shader': 'document',
  'skybox.source': 'document',
  'canvas.layer': 'document',
  'image.export': 'document',
  'document.load': 'document',
  'document.save': 'document',
  'document.close': 'document',
  'document.delete': 'document',
  'assets.reveal': 'library',
  // A face that will not open is read where the document it was set in is read: the caption is
  // still there, drawn in the fallback, and this is what says why it does not look right.
  'font.face': 'document',
}

/**
 * The renderer's own failures. Without this channel they have nowhere to go: `console.error` in
 * a component leaves nothing behind in a packaged build.
 *
 * They reach the journal through here rather than through each caller, for the same reason the
 * API failures go through `reducedBy` — this IS the funnel, and `reportFailure` already
 * deduplicates on the other side (an engine is rebuilt on every detach, invariant 3).
 *
 * The message is the renderer's own: it has no SDK, so nothing it writes carries a request, and
 * `MAX_LOG_MESSAGE` bounds it on both sides of the boundary.
 */
export function registerDiagnosticsHandlers(journal: () => ActivityLog): void {
  handle(CHANNELS.diagnosticsReport, (_event, entry) => {
    const { level, scope, message } = parseLogEntry(entry)
    // Prefixed here rather than sent prefixed, so a line can never claim to come from this side.
    log[level](`renderer/${scope}`, message)

    // `parseLogEntry` has already refused anything outside `LOG_SCOPES`; the guard is what lets
    // the table below stay exhaustive rather than defaulting.
    if (!isLogScope(scope)) return

    journal().record({
      level,
      topic: TOPIC_OF_SCOPE[scope],
      messageKey: `activity.scope.${scope}`,
      detail: message,
    })
  })
}

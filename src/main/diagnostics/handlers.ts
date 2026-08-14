import { CHANNELS, type LogScope } from '@shared/ipc'
import type { ActivityTopic } from '@shared/domain/activity'
import { handle } from '@main/ipc/handle'
import { log } from '@main/log'
import type { ActivityLog } from '@main/project/activity-log'
import { parseLogEntry } from './validation'

/**
 * Which part of the journal a renderer scope belongs to. A closed union on both sides, so a new
 * scope cannot be added without deciding where its failures are read.
 */
const TOPIC_OF_SCOPE: Record<LogScope, ActivityTopic> = {
  'scene.model': 'document',
  'scene.bvh': 'document',
  'scene.texture': 'document',
  'scene.export': 'document',
  'scene.render': 'document',
  'texture.map': 'document',
  'texture.channel': 'document',
  'texture.seam': 'document',
  // With the document, not the library: an export writes outside the project, and what its
  // failure says something about is the texture that was open.
  'texture.export': 'document',
  // A chunk three renamed upstream, so a material setting silently stopped applying. Read with
  // the document because that is where it shows — as a slider that moves nothing.
  'texture.shader': 'document',
  'skybox.source': 'document',
  'skybox.export': 'document',
  'canvas.layer': 'document',
  'image.export': 'document',
  'document.load': 'document',
  'document.save': 'document',
  'document.close': 'document',
  'document.delete': 'document',
  'assets.reveal': 'library',
  // An asset with nowhere to go is read with the shelf it was double-clicked in, not with the
  // document that refused it — there is none, and that is exactly what the line says.
  'assets.open': 'library',
  // Read with the shelf whose tile is now behind, not with the document — that one was saved.
  'assets.save': 'library',
  // `import`, with the lines the extraction itself writes: what it produces is bytes landing in
  // the project, and a failure filed away from its own outcome reads as a different event.
  'assets.extract': 'import',
  // The shelf of recent projects: none of its three rows is about the project that is open in
  // particular, and all three are about a folder — read with the project topic the main process
  // already writes there.
  'project.reveal': 'project',
  'project.forget': 'project',
  'project.rename': 'project',
  // A face that will not open is read where the document it was set in is read: the caption is
  // still there, drawn in the fallback, and this is what says why it does not look right.
  'font.face': 'document',
  'shell.render': 'shell',
  'shell.layout': 'shell',
  'shell.menu': 'shell',
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

    journal().record({
      level,
      topic: TOPIC_OF_SCOPE[scope],
      messageKey: `activity.scope.${scope}`,
      detail: message,
    })
  })
}

import { CHANNELS } from '@shared/ipc'
import { handle } from '@main/ipc/handle'
import { windowLanguage } from '@main/window/language'
import type { SystemFonts } from './systemFonts'

/**
 * What the machine has installed, offered to a renderer that has no filesystem to look with.
 *
 * Two channels and not one: a picker needs every name at once, while outlines are worth several
 * hundred kilobytes and are wanted for the single face someone actually set text in.
 */
export function registerFontHandlers(fonts: SystemFonts): void {
  handle(CHANNELS.fontsList, () => fonts.families(windowLanguage()).then(families => [...families]))

  handle(CHANNELS.fontsRead, (_event, family) => {
    // The sandboxed side is trusted for nothing, as in `registerDiagnosticsHandlers`. A family
    // never becomes a path — the index the main process built is what resolves it — but a
    // handler that takes the word of whatever arrives is one refactor away from one that does.
    if (typeof family !== 'string' || family === '') return Promise.resolve(null)

    return fonts.bytesOf(family)
  })
}

import { CHANNELS } from '@shared/ipc'
import { handle } from '@main/ipc/handle'
import type { StylesStore } from './store'
import { parseSavedStyle, parseStyleId, parseStyleName } from './validation'

/**
 * The four channels of the styles panel. Unlike a favourite, which is read from the catalogue
 * here, a style is composed in the window — the values it captures are the ones on screen, and
 * the main process has no texture open to read them from. So the whole shape crosses, and the
 * whole shape is validated on arrival.
 */
export function registerStyleHandlers(styles: StylesStore): void {
  handle(CHANNELS.stylesList, () => styles.list())
  handle(CHANNELS.stylesSave, (_event, style) => styles.save(parseSavedStyle(style)))
  handle(CHANNELS.stylesRename, (_event, id, name) =>
    styles.rename(parseStyleId(id), parseStyleName(name)),
  )
  handle(CHANNELS.stylesRemove, (_event, id) => styles.remove(parseStyleId(id)))
}

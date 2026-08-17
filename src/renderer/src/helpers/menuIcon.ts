import { MENU_ICON_SIZE } from '@shared/domain/contextMenu'
import { THEME_ATTRIBUTE } from '@shared/domain/settings'
import { MDI_VIEWBOX, mdiPath } from './mdiCanvas'

/** Drawn once per glyph and colour: a menu is raised again and again over the same rows. */
const drawn = new Map<string, string>()

/**
 * The colour a native menu draws its text in, which is the colour its glyphs have to be.
 *
 * macOS ignores it — the icons cross as template images and it recolours them from their alpha
 * alone. Windows and Linux do not, and a black glyph on a dark menu is an invisible one. Read
 * off the root element rather than the settings store: `system` resolves there and nowhere else,
 * and this is called from a pointer handler that holds no hooks.
 */
function ink(): string {
  return document.documentElement.dataset['theme'] === THEME_ATTRIBUTE.dark ? '#ffffff' : '#000000'
}

/**
 * An `@mdi/js` path as a PNG the system's menu can draw.
 *
 * `nativeImage` reads no SVG, so the glyph has to arrive as a bitmap, and only this side can
 * make one — the main process has no canvas. The path itself comes from `mdiPath`, the same one
 * the timeline paints with.
 *
 * Answers `undefined` where there is no canvas to draw on, and the menu is then popped without
 * glyphs — which is how the tests see it.
 */
export function menuIcon(path: string): string | undefined {
  // No DOM at all where the helpers run without a browser, which is most of this folder's tests.
  if (typeof document === 'undefined') return undefined

  const colour = ink()
  const key = `${colour} ${path}`

  const cached = drawn.get(key)
  if (cached) return cached

  const canvas = document.createElement('canvas')
  canvas.width = MENU_ICON_SIZE
  canvas.height = MENU_ICON_SIZE

  const context = canvas.getContext('2d')
  if (!context) return undefined

  const scale = MENU_ICON_SIZE / MDI_VIEWBOX
  context.scale(scale, scale)
  context.fillStyle = colour
  context.fill(mdiPath(path))

  const url = canvas.toDataURL('image/png')
  drawn.set(key, url)
  return url
}

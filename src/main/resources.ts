import { join } from 'node:path'

/**
 * The icon as `nativeImage` needs it. PNG, not the SVG master: `nativeImage` cannot read SVG,
 * so a window icon or an About dialog built from `icon.svg` would come out empty.
 *
 * Resolved from `out/main/`, which puts it at the project root in development and inside the
 * asar archive once packaged — hence `build/icon.png` in the electron-builder `files` list.
 */
export const APP_ICON_PATH = join(import.meta.dirname, '../../build/icon.png')

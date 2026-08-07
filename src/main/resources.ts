import { join } from 'node:path'
import { isDevelopment } from './environment'

/**
 * The icon as `nativeImage` needs it. PNG, not the SVG master: `nativeImage` cannot read SVG,
 * so a window icon or an About dialog built from `icon.svg` would come out empty.
 *
 * Resolved from `out/main/`, which puts it at the project root in development and inside the
 * asar archive once packaged — hence `build/icon.png` in the electron-builder `files` list.
 */
export const APP_ICON_PATH = join(import.meta.dirname, '../../build/icon.png')

/**
 * Where files shipped beside the app live — `extraResources` in `electron-builder.yml`, which
 * lands them in `Contents/Resources` on macOS and `resources/` elsewhere.
 *
 * They are NOT in the asar: a binary has to be executable on disk to be spawned. In
 * development the same layout exists at the project root, filled by `pnpm ffmpeg:fetch`.
 */
export function resourcesRoot(): string {
  return isDevelopment ? join(import.meta.dirname, '../../resources') : process.resourcesPath
}

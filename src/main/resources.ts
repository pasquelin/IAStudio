import { join } from 'node:path'
import { isDevelopment } from '@main/environment'

/** The checkout root, seen from the compiled `out/main/`. */
const PROJECT_ROOT = join(import.meta.dirname, '../..')

/**
 * The icon as `nativeImage` needs it. PNG, not the SVG master: `nativeImage` cannot read SVG,
 * so a window icon or an About dialog built from `icon.svg` would come out empty.
 *
 * Resolved from `out/main/`, which puts it at the project root in development and inside the
 * asar archive once packaged — hence `build/icon.png` in the electron-builder `files` list.
 */
export const APP_ICON_PATH = join(PROJECT_ROOT, 'build/icon.png')

/**
 * Where files shipped beside the app live — `extraResources` in `electron-builder.yml`, which
 * lands them in `Contents/Resources` on macOS and `resources/` elsewhere.
 *
 * They are NOT in the asar: a binary has to be executable on disk to be spawned. In
 * development the same layout exists at the project root, filled by `pnpm ffmpeg:fetch`.
 */
export function resourcesRoot(): string {
  return isDevelopment ? join(PROJECT_ROOT, 'resources') : process.resourcesPath
}

/**
 * The encoder the studio ships with, per platform. It carries its own rather than asking for
 * one: an import that needs a proxy or a waveform is not the moment to teach someone what a
 * codec is, and a system ffmpeg whose library has moved looks installed while refusing to run.
 */
export function bundledFfmpeg(root: string, platform: NodeJS.Platform): string {
  return join(root, 'ffmpeg', platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg')
}

/**
 * The voice detector dictation listens through, fetched by `pnpm stt:fetch`. The same bytes on
 * every platform — it is read by the engine, not executed, so nothing here varies.
 */
export function bundledVad(root: string): string {
  return join(root, 'stt', 'silero_vad.onnx')
}

/**
 * Where the animations shipped with the app live — one folder per animation, holding the clip
 * and its `thumb.png`. Common to every project, read-only, updated by updating the app.
 */
export function bundledAnimations(root: string): string {
  return join(root, 'animations')
}

/**
 * The working textures the app ships with — a grid and a checker, written by
 * `scripts/make-checker-textures.mjs`. Copied into a project the first time a scene wants one.
 */
export function bundledTextures(root: string): string {
  return join(root, 'textures')
}

/** The picture of each local model — one PNG named after the model it stands for. */
export function bundledModels(root: string): string {
  return join(root, 'models')
}

/** The still drawn of each scene template — one PNG named after the template it shows. */
export function bundledTemplates(root: string): string {
  return join(root, 'templates')
}

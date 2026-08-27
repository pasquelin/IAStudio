/**
 * What an exported game ships beside its page, and the one thing its writer and its reader both
 * read. The writer is the main process, the reader is the page: neither parses the other's code.
 */
export const EXPORTED_GAME_VERSION = 1

/** Named rather than spelled twice: the page fetches it, the writer writes it. */
export const EXPORTED_GAME_FILE = 'game.json'

export type ExportedScene = {
  /** The document id, which every reference of a scene already carries. */
  id: string
  /** What a person calls it — and what `game.scene.load` may name it by. */
  title: string
  /** Where the glTF sits, relative to the page. */
  file: string
}

export type ExportedScript = {
  /** The reference a `Script` component carries, as `refToString` spells one. */
  script: string
  file: string
}

export type ExportedGame = {
  version: number
  title: string
  /** The scene the game opens on. One of `scenes`, or the game shows nothing. */
  entryScene: string
  scenes: readonly ExportedScene[]
  scripts: readonly ExportedScript[]
  /** Asset id → the file beside the page. What `createBundledAssets` is handed. */
  assets: Readonly<Record<string, string>>
}

/** Which scene a name stands for — its title first, as a person says it, then its id. */
export function exportedSceneNamed(game: ExportedGame, named: string): ExportedScene | null {
  return (
    game.scenes.find(one => one.title === named) ??
    game.scenes.find(one => one.id === named) ??
    null
  )
}

/** One scene as it is handed over: its identity, and the glTF it is. */
export type SceneToExport = { id: string; title: string; content: string }

/** One script, already JavaScript — the studio transpiles, the sandbox never sees TypeScript. */
export type ScriptToExport = { script: string; code: string }

/** What the WINDOW composes and hands over: the scenes as glTF, the scripts as JavaScript. */
export type GameExportRequest = {
  title: string
  /** The scene the game opens on, by document id. */
  entryScene: string
  scenes: readonly SceneToExport[]
  scripts: readonly ScriptToExport[]
}

export type GameExportOutcome = {
  /** The folder's NAME, never its path: where it sits is the main process's business. */
  folder: string
  scenes: number
  scripts: number
  assets: number
  /** Assets a scene points at and the catalogue no longer holds — listed, never dropped. */
  missing: readonly string[]
}

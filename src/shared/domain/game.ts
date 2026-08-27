import { FOLDER_ROOT, isUnder } from './folder'

/**
 * What makes a project a GAME — one project, one game, and no document kind of its own.
 *
 * The scenes stay `.gltf` documents and the scripts stay ordinary `.ts` files of the project;
 * this manifest is what names which of them the game starts on, and what resolves the two
 * reference kinds nothing else can resolve — see `domain/ref.ts`.
 *
 * Creative property of the project in the sense of ADR-24: it sits in the project folder, in the
 * open, versioned by git and readable by hand.
 */
export const GAME_VERSION = 1

/**
 * Not under a dot, unlike `.project.json` and `.project-context.json`: this one is the author's
 * file, not the machine's. It shows in the explorer and travels with the project.
 */
export const GAME_FILE = 'game.json'

/**
 * A script identifier bound to the path of its file.
 *
 * 🛑 **The one fragile point of the whole reference strategy**, and it is fragile because a
 * script is a PATH: everything else the studio references carries an identifier of its own,
 * which renaming cannot break. Moving or deleting a `.ts` file has to come here — see
 * `withScriptMoved` and `withScriptForgotten`.
 */
export type GameScript = { id: string; path: string }

/** What a script IS on disk, and the only extension the studio runs. */
export const SCRIPT_EXTENSION = '.ts'

/** One script's file and its text — what a PLAY compiles, and what an editor opens. */
export type GameScriptFile = { path: string; source: string }

/** A reusable piece, named, defined by the document it lives in. */
export type GamePrefab = { id: string; name: string; document: string }

/** What the author sets for the game as a whole rather than for one scene. */
export type GameSettings = { title: string }

export type GameManifest = {
  version: number
  /** Document identifiers, in the order the author arranged them. */
  scenes: readonly string[]
  /** Which of `scenes` the game opens on, or nothing while the author has not said. */
  entryScene: string | null
  scripts: readonly GameScript[]
  prefabs: readonly GamePrefab[]
  settings: GameSettings
}

/** Why a manifest could not be read: repair the file, or update the studio. */
export type GameTrouble = 'unreadable' | 'too-new'

export type GameState = { game: GameManifest; trouble: GameTrouble | null }

/** What a project that never declared a game answers — which is not a fault. */
export function emptyGame(): GameManifest {
  return {
    version: GAME_VERSION,
    scenes: [],
    entryScene: null,
    scripts: [],
    prefabs: [],
    settings: { title: '' },
  }
}

export function noGame(): GameState {
  return { game: emptyGame(), trouble: null }
}

/** Where a `script` reference lands, or nothing when the manifest does not hold it. */
export function scriptPathOf(game: GameManifest, id: string): string | null {
  return game.scripts.find(script => script.id === id)?.path ?? null
}

/**
 * The manifest after a file or a FOLDER moved. Both, because a folder rename moves every script
 * under it at once and each one would otherwise keep pointing at a path the disk no longer has.
 */
export function withScriptMoved(game: GameManifest, from: string, to: string): GameManifest {
  return { ...game, scripts: game.scripts.map(script => movedScript(script, from, to)) }
}

/** The manifest after a file or a folder went away — the same reach, and the same reason. */
export function withScriptForgotten(game: GameManifest, path: string): GameManifest {
  return { ...game, scripts: game.scripts.filter(script => !isPathOrUnder(script.path, path)) }
}

const movedScript = (script: GameScript, from: string, to: string): GameScript =>
  isPathOrUnder(script.path, from)
    ? { ...script, path: to + script.path.slice(from.length) }
    : script

/**
 * The path itself as well as what it holds — `isUnder` answers only for what is INSIDE, and
 * answers TRUE for every path when asked about the root, which no rename and no deletion names.
 */
const isPathOrUnder = (path: string, target: string): boolean =>
  target !== FOLDER_ROOT && (path === target || isUnder(path, target))

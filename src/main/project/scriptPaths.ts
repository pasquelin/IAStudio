import { messageOf } from '@shared/guards'
import type { PathChange } from '@shared/domain/fileOp'
import {
  withScriptForgotten,
  withScriptMoved,
  type GameManifest,
  type GameState,
} from '@shared/domain/game'
import { log } from '@main/log'
import { GameLockedError, type ProjectGameStore } from './game'

/**
 * A script is referenced by PATH, so moving or trashing a `.ts` has to reach `game.json`.
 *
 * 🛑 Blind spot, and it is half the reference: the `Script` component carries the path in the
 * `.gltf` of its scene and no rename reaches there — a renamed script comes back as « script
 * never loaded », with nothing red. 🛑 Never rejects: called for its effect from a finished lot.
 */
export async function keepScriptPaths(
  game: ProjectGameStore,
  changes: readonly PathChange[],
): Promise<void> {
  let held: GameState
  try {
    held = await game.read()
  } catch {
    // Unreadable is a file the author has to repair; a rename must not be what tells them.
    return
  }
  if (held.trouble !== null || held.game.scripts.length === 0) return

  let manifest = held.game
  // 🛑 Every change, not just the ones NAMING a `.ts`: renaming a folder moves every script under
  // it at once, and neither side of that change carries an extension.
  for (const change of changes) {
    // `to` empty is the trash, which has no inverse — the script is forgotten rather than moved.
    manifest = change.to
      ? withScriptMoved(manifest, change.from, change.to)
      : withScriptForgotten(manifest, change.from)
  }
  // By CONTENT: `withScriptMoved` rebuilds the manifest whether or not a path changed, so
  // identity would have every rename in the project write the file.
  if (samePaths(manifest.scripts, held.game.scripts)) return

  try {
    await game.write(manifest)
  } catch (error) {
    // A manifest the studio refuses to overwrite stays as its author wrote it — see the refusal.
    const said = error instanceof GameLockedError ? error.trouble : messageOf(error)
    log.warn('game', `script paths not followed into game.json: ${said}`)
  }
}

const samePaths = (one: GameManifest['scripts'], other: GameManifest['scripts']): boolean =>
  one.length === other.length && one.every((script, at) => script.path === other[at]?.path)

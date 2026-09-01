import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { isRecord } from '@shared/guards'
import {
  emptyGame,
  GAME_FILE,
  GAME_VERSION,
  noGame,
  type GameManifest,
  type GameState,
  type GameTrouble,
} from '@shared/domain/game'
import { isMissing, writeAtomic, writeQueue } from '@main/persistence'
import { parseGame } from './validation'

/** Thrown rather than swallowed: what this refuses to overwrite is the author's own file. */
export class GameLockedError extends Error {
  constructor(readonly trouble: GameTrouble) {
    super(`game manifest is ${trouble}`)
  }
}

export type ProjectGameStore = {
  read: () => Promise<GameState>
  /** The whole manifest in, the whole truth back — as the project's context does. */
  write: (game: GameManifest) => Promise<GameState>
}

export type ProjectGameDeps = {
  rootOf: () => string | null
}

/**
 * 🛑 Two losses by design: a key the schema does not name is dropped at the next write — which is
 * what raising the version, and `too-new`, are for — and two windows both write the whole file,
 * last one wins.
 */
export function createProjectGame(deps: ProjectGameDeps): ProjectGameStore {
  const writes = writeQueue()

  const fileOf = (): string | null => {
    const root = deps.rootOf()
    return root === null ? null : join(root, GAME_FILE)
  }

  // Takes the file rather than asking for it, exactly as the context store does: a second
  // `rootOf()` would read the project opened between this one's read and its write.
  const readFrom = async (file: string): Promise<GameState> => {
    let body: string
    try {
      body = await readFile(file, 'utf8')
    } catch (error) {
      // A project that declares no game is the ordinary case, and it is not a fault.
      if (isMissing(error)) return noGame()
      return { game: emptyGame(), trouble: 'unreadable' }
    }

    return stateOf(body)
  }

  const read = async (): Promise<GameState> => {
    const file = fileOf()
    return file === null ? noGame() : await readFrom(file)
  }

  const write = async (game: GameManifest): Promise<GameState> => {
    const file = fileOf()
    if (file === null) throw new Error('no project is open')

    // Read before write, and the refusal is the point — see `GameLockedError`.
    const trouble = (await readFrom(file)).trouble
    if (trouble !== null) throw new GameLockedError(trouble)

    // Recomposed member by member, as the context store does: spreading would carry a key the
    // schema does not name into the file, where nothing would ever read it back.
    const stored: GameManifest = {
      version: GAME_VERSION,
      scenes: [...game.scenes],
      entryScene: game.entryScene,
      scripts: game.scripts.map(({ id, path }) => ({ id, path })),
      prefabs: game.prefabs.map(({ id, name, document }) => ({ id, name, document })),
      settings: { title: game.settings.title },
    }
    // Indented and queued: a file read by hand and versioned by git is not minified, and two
    // windows saving at once must not tear it in half.
    await writes.next(() => writeAtomic(file, `${JSON.stringify(stored, null, 2)}\n`))

    return { game: stored, trouble: null }
  }

  return { read, write }
}

/** The version is read before the schema, so « update the studio » and « repair it » stay apart. */
function stateOf(body: string): GameState {
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return { game: emptyGame(), trouble: 'unreadable' }
  }

  if (isRecord(parsed) && typeof parsed.version === 'number' && parsed.version > GAME_VERSION) {
    return { game: emptyGame(), trouble: 'too-new' }
  }

  try {
    return { game: parseGame(parsed), trouble: null }
  } catch {
    return { game: emptyGame(), trouble: 'unreadable' }
  }
}

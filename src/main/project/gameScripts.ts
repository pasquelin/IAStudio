import { readFile } from 'node:fs/promises'
import { isAbsolute, relative, resolve } from 'node:path'
import { SCRIPT_EXTENSION, type GameScriptFile } from '@shared/domain/game'
import type { FolderEntry } from '@shared/domain/folder'
import { isMissing, writeAtomic, writeQueue } from '@main/persistence'

export type GameScriptStore = {
  /** Every script the project holds, read whole: a PLAY compiles the lot. */
  list: () => Promise<GameScriptFile[]>
  /** Whether it was written. Refused for a path that is not a script of THIS project. */
  write: (path: string, source: string) => Promise<boolean>
}

export type GameScriptDeps = {
  rootOf: () => string | null
  /** The project's own walk — one depth bound and one refusal, shared with the explorer. */
  walk: () => Promise<FolderEntry[]>
}

/**
 * The `.ts` files a game runs.
 *
 * 🛑 Every path comes from the WINDOW, which invariant 1 does not trust with the disk: it is
 * resolved against the project root and refused if it lands outside it, whatever `..` it holds.
 */
export function createGameScripts(deps: GameScriptDeps): GameScriptStore {
  const writes = writeQueue()

  return {
    list: async () => {
      const root = deps.rootOf()
      if (root === null) return []

      const found: GameScriptFile[] = []
      for (const entry of await deps.walk()) {
        const file = insideProject(root, entry.path)
        if (file === null) continue
        try {
          found.push({ path: entry.path, source: await readFile(file, 'utf8') })
        } catch (error) {
          // A file the walk saw and the read cannot: renamed underneath, or gone. Not a fault.
          if (!isMissing(error)) throw error
        }
      }
      // A plain comparison: these are paths, not words, and no reader's language orders them.
      return found.sort((one, other) =>
        one.path < other.path ? -1 : one.path > other.path ? 1 : 0,
      )
    },

    write: async (path, source) => {
      const root = deps.rootOf()
      const file = root === null ? null : insideProject(root, path)
      if (file === null) return false

      await writes.next(() => writeAtomic(file, source))
      return true
    },
  }
}

/** Where the path lands, or nothing at all for anything that is not a script of this project. */
function insideProject(root: string, path: string): string | null {
  if (!path.endsWith(SCRIPT_EXTENSION)) return null

  const full = resolve(root, path)
  const held = relative(root, full)
  // Empty is the root itself; a leading `..` or an absolute answer is a path that left.
  if (held.length === 0 || held.startsWith('..') || isAbsolute(held)) return null
  // Under a dot is the studio's own bookkeeping, which `isStudioPrivate` refuses everywhere else.
  return held.split(/[\\/]/).some(part => part.startsWith('.')) ? null : full
}

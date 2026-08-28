import { join } from 'node:path'
import { MEMORY_FILE, MEMORY_INDEX_FILE } from '@shared/domain/project'
import type { AsyncMemory } from './memoryClient'

/**
 * Which memory answers, and when its thread is opened.
 *
 * 🛑 Opened LAZILY, and that is what keeps CLAUDE.md's performance rule: opening a project must
 * not pay for a thread, a database and a file nobody has asked a question of yet. A project with
 * no memory and no assistant turn never starts one at all.
 *
 * Two of them, and they never meet: the project's travels with its folder, the machine's stays
 * here. Nothing copies between the two — promoting a memory is a gesture the person makes, which
 * writes a new one.
 */

export type MemoryHost = {
  /** The open project's memory. Nothing when no project is open. */
  project: () => Promise<AsyncMemory | null>
  /** The machine's own. Always there, whatever is open. */
  global: () => Promise<AsyncMemory>
  /** Follows what the project store publishes. Closes what the previous project held. */
  follow: (root: string | null) => void
  close: () => Promise<void>
}

export type MemoryHostDeps = {
  /** Where the machine's own memory lives — `userData`, passed so this file needs no Electron. */
  userData: string
  open: (file: string, database: string) => Promise<AsyncMemory>
  /** Said when a memory cannot be opened at all. The studio goes on without one. */
  onTrouble: (message: string) => void
}

export function createMemoryHost({ userData, open, onTrouble }: MemoryHostDeps): MemoryHost {
  let root: string | null = null
  // The PROMISE is held, never the memory: two turns asking at once must not open two threads on
  // one database, which is two writers on a file SQLite gives to one.
  let opening: Promise<AsyncMemory | null> | null = null
  let openingGlobal: Promise<AsyncMemory> | null = null

  const openAt = async (at: string): Promise<AsyncMemory | null> => {
    try {
      return await open(join(at, MEMORY_FILE), join(at, MEMORY_INDEX_FILE))
    } catch (error) {
      // A memory that will not open costs the memory, never the project: the studio has worked
      // without one until now and goes on doing so.
      onTrouble(error instanceof Error ? error.message : String(error))
      return null
    }
  }

  return {
    project: async () => {
      if (root === null) return null

      opening ??= openAt(root)
      return await opening
    },

    global: async () => {
      openingGlobal ??= open(join(userData, 'memory.ndjson'), join(userData, 'memory.db'))
      return await openingGlobal
    },

    follow: next => {
      if (next === root) return

      const leaving = opening
      root = next
      opening = null
      // Not awaited: what is closing belongs to a project nobody is looking at any more, and the
      // window asking for the next one must not wait on the previous one letting go.
      if (leaving) void closeQuietly(leaving, onTrouble)
    },

    close: async () => {
      const held = [opening, openingGlobal]
      opening = null
      openingGlobal = null
      root = null
      await Promise.all(held.map(one => (one ? closeQuietly(one, onTrouble) : Promise.resolve())))
    },
  }
}

/** Closing is bookkeeping: a thread that will not go must not stop the studio from quitting. */
async function closeQuietly(
  opening: Promise<AsyncMemory | null>,
  onTrouble: (message: string) => void,
): Promise<void> {
  try {
    await (await opening)?.close()
  } catch (error) {
    onTrouble(error instanceof Error ? error.message : String(error))
  }
}

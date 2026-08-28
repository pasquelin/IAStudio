import { appendFile, mkdir, readFile, rm, stat } from 'node:fs/promises'
import { dirname } from 'node:path'
import {
  MEMORY_VERSION,
  type Memory,
  type MemoryDraft,
  type MemoryPatch,
  type MemoryQuery,
  type MemoryTrouble,
} from '@shared/domain/assistantMemory'
import { isMissing, writeQueue } from '@main/persistence'
import type { MemoryIndex } from './memoryIndex'
import { parseMemory, versionOf } from './validation'

/**
 * The memories themselves — one JSON object per line, appended, never rewritten in place.
 *
 * 🛑 THIS is what a project carries. The index beside it under `.index/` is derived and is thrown
 * away without a thought; this file is not, which is why it sits in `.ia-studio/` with
 * `items.json` and outside what the studio's `.gitignore` excludes.
 *
 * Append-only for two reasons that both matter: adding a memory costs one write whatever the file
 * holds, and a process that dies mid-write loses the line it was writing rather than the file.
 * What that costs is a compaction, which is a later lot's business.
 */

export type MemoryStore = {
  remember: (draft: MemoryDraft) => Promise<Memory>
  /** Rewrites what a memory says. Nothing when no such memory is held. */
  amend: (id: string, patch: MemoryPatch) => Promise<Memory | null>
  /** Writes it down as dropped, which is what forgetting is when the file is a log. */
  forget: (id: string) => Promise<boolean>
  read: (id: string) => Promise<Memory | null>
  list: (query: MemoryQuery) => Promise<readonly Memory[]>
  markUsed: (ids: readonly string[]) => Promise<void>
  /** Reads the file back into the index. Answers how many memories stand once it has. */
  rebuild: () => Promise<number>
  /** Everything forgotten, the file included. What « reset this project's memory » runs. */
  reset: () => Promise<void>
  /** Why the file answered nothing when it should have. Read after `rebuild`. */
  trouble: () => MemoryTrouble | null
  close: () => void
}

export type MemoryStoreDeps = {
  /** The file that holds them. One store per file — the project's, or the machine's. */
  file: string
  index: MemoryIndex
  now: () => string
  /** Minted here rather than in the domain: only the caller knows what is already taken. */
  newId: () => string
}

const lineOf = (memory: Memory): string => `${JSON.stringify({ v: MEMORY_VERSION, ...memory })}\n`

/** What a `stat` of the file says, or nothing when there is no file yet. */
async function stampOf(file: string): Promise<{ bytes: number; modifiedAt: number } | null> {
  try {
    const stats = await stat(file)
    return { bytes: stats.size, modifiedAt: Math.trunc(stats.mtimeMs) }
  } catch (error) {
    if (isMissing(error)) return null
    throw error
  }
}

export function createMemoryStore({ file, index, now, newId }: MemoryStoreDeps): MemoryStore {
  const writes = writeQueue()
  let trouble: MemoryTrouble | null = null

  const append = async (memory: Memory): Promise<void> => {
    await mkdir(dirname(file), { recursive: true })
    await appendFile(file, lineOf(memory), 'utf8')

    const stamp = await stampOf(file)
    if (stamp) index.restamp(stamp)
  }

  /**
   * The file, applied line by line, latest wins. A memory written three times is held once, as
   * its last line describes it — that is what makes an append-only file a store rather than a log.
   */
  const readFileInto = async (): Promise<number> => {
    trouble = null

    let body: string
    try {
      body = await readFile(file, 'utf8')
    } catch (error) {
      // A project that never remembered anything is the ordinary case, not a fault.
      if (isMissing(error)) {
        index.clear()
        return 0
      }
      trouble = 'unreadable'
      return 0
    }

    const held = new Map<string, Memory>()

    for (const line of body.split('\n')) {
      if (line.trim().length === 0) continue

      let value: unknown
      try {
        value = JSON.parse(line)
      } catch {
        // One broken line costs that memory and no other — the whole point of a line per object.
        trouble ??= 'unreadable'
        continue
      }

      const version = versionOf(value)
      if (version === null) {
        trouble ??= 'unreadable'
        continue
      }

      if (version > MEMORY_VERSION) {
        // Kept in the file untouched and left out of the index: this build cannot read it, and
        // rewriting the file would destroy what a later one wrote.
        trouble = 'too-new'
        continue
      }

      const memory = parseMemory(value)
      if (memory === null) {
        trouble ??= 'unreadable'
        continue
      }

      held.set(memory.id, memory)
    }

    const standing = [...held.values()].filter(memory => memory.state !== 'dropped')
    index.clear()
    index.putAll(standing)

    const stamp = await stampOf(file)
    if (stamp) index.restamp(stamp)

    return standing.length
  }

  return {
    remember: draft =>
      writes.next(async () => {
        const memory: Memory = {
          id: newId(),
          type: draft.type,
          summary: draft.summary,
          body: draft.body ?? '',
          importance: draft.importance,
          createdAt: now(),
          source: draft.source,
          refs: draft.refs ?? [],
          links: draft.links ?? [],
          state: draft.state ?? 'live',
        }

        // The file first, always: an index holding what the file does not is an index that
        // answers a memory a restart makes vanish.
        await append(memory)
        index.put(memory)
        return memory
      }),

    amend: (id, patch) =>
      writes.next(async () => {
        const held = index.read(id)
        if (held === null) return null

        const amended: Memory = { ...held, ...patch }
        await append(amended)
        index.put(amended)
        return amended
      }),

    forget: id =>
      writes.next(async () => {
        const held = index.read(id)
        if (held === null) return false

        // Written down as dropped: the file is a log, so the only way to say « this is gone »
        // is to say it.
        await append({ ...held, state: 'dropped' })
        index.remove(id)
        return true
      }),

    read: async id => index.read(id),

    list: async query => index.list(query),

    markUsed: async ids => index.markUsed(ids, now()),

    rebuild: () => writes.next(readFileInto),

    reset: () =>
      writes.next(async () => {
        index.clear()
        trouble = null
        await rm(file, { force: true })
      }),

    trouble: () => trouble,

    close: () => index.close(),
  }
}

import { appendFile, mkdir, readFile, rm, stat } from 'node:fs/promises'
import { dirname } from 'node:path'
import {
  isReadable,
  MEMORY_VERSION,
  type Memory,
  type MemoryDraft,
  type MemoryPatch,
  type MemoryQuery,
  type MemoryTrouble,
} from '@shared/domain/assistantMemory'
import { defined } from '@shared/guards'
import { orElse } from '@shared/promises'
import { isMissing, writeQueue } from '@main/persistence'
import type { MemoryIndex, MemoryStamp } from './memoryIndex'
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
  /** Reads the file back into the index, whatever the index already holds. */
  rebuild: () => Promise<number>
  /**
   * Reads it only if it has CHANGED since the index was built — what an opening runs.
   *
   * The comparison is a `stat` against a stored stamp: 15 µs against the 400 ms a rebuild of ten
   * thousand memories costs, both measured. Without it every first question of every session
   * pays a full read of a file nothing has touched.
   */
  refresh: () => Promise<number>
  /** Everything forgotten, the file included. What « reset this project's memory » runs. */
  reset: () => Promise<void>
  /** Why the file answered nothing when it should have. Read after `rebuild`. */
  trouble: () => MemoryTrouble | null
  /** Settles what is queued, then shuts the database. What a quit and a project change await. */
  close: () => Promise<void>
}

export type MemoryStoreDeps = {
  /** The file that holds them. One store per file — the project's, or the machine's. */
  file: string
  index: MemoryIndex
  now: () => string
  /** Minted here rather than in the domain: only the caller knows what is already taken. */
  newId: () => string
}

/**
 * `usedAt` is dropped — `JSON.stringify` omits an undefined key — because it belongs to THIS
 * machine and the file travels with the project. See `Memory`.
 */
const lineOf = (memory: Memory): string =>
  `${JSON.stringify({ v: MEMORY_VERSION, ...memory, usedAt: undefined })}\n`

/**
 * What a `stat` says, or nothing. Nothing for a file that is not there yet AND for one that will
 * not stat: the stamp is bookkeeping, and a write already on disk must not fail over it.
 */
async function stampOf(file: string): Promise<{ bytes: number; modifiedAt: number } | null> {
  const stats = await orElse(stat(file), null)
  return stats && { bytes: stats.size, modifiedAt: Math.trunc(stats.mtimeMs) }
}

/**
 * Whether the file has moved since the index was built.
 *
 * A function of its own because it is the whole of what `refresh` decides, and the alternative
 * was a test that rewrites a file and puts its mtime back — which APFS does not allow: `utimes`
 * rounds a fractional `mtimeMs` and the stamp moves by one, measured, in both directions.
 *
 * No stamp means an index that has never read this file. No file means one that is gone, and
 * both are stale: the first has everything to read, the second has everything to forget.
 */
export function hasMoved(held: MemoryStamp | null, now: MemoryStamp | null): boolean {
  if (held === null || now === null) return true

  return held.bytes !== now.bytes || held.modifiedAt !== now.modifiedAt
}

export function createMemoryStore({ file, index, now, newId }: MemoryStoreDeps): MemoryStore {
  const writes = writeQueue()
  let trouble: MemoryTrouble | null = null
  // Made once rather than on every append: a recursive `mkdir` on a folder that is already there
  // measured 61 µs against the 140 µs the append itself costs.
  let folder: Promise<unknown> | null = null

  const append = async (memory: Memory): Promise<void> => {
    try {
      folder ??= mkdir(dirname(file), { recursive: true })
      await folder
    } catch (error) {
      // Forgotten so the next write tries again: a folder removed under a running studio, or a
      // volume that blinked, must not stop this memory persisting for the rest of the session.
      folder = null
      throw error
    }
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
      // Emptied as well: answering `0` to the window while `list` still served the old rows had
      // the panel told « nothing » and showing something.
      trouble = 'unreadable'
      index.clear()
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

    // The file has no `usedAt` to give back, so it is taken from the index before it is emptied:
    // what this machine served is the one thing a rebuild would otherwise destroy.
    const served = new Map(
      index.list({ limit: Number.MAX_SAFE_INTEGER }).map(one => [one.id, one.usedAt]),
    )
    const standing = [...held.values()]
      .filter(isReadable)
      .map(memory => ({ ...memory, ...defined({ usedAt: served.get(memory.id) }) }))

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
          ...draft,
          id: newId(),
          body: draft.body ?? '',
          createdAt: now(),
          refs: draft.refs ?? [],
          links: draft.links ?? [],
          state: draft.state ?? 'live',
        }

        // The file first, always: an index holding what the file does not is an index that
        // answers a memory a restart makes vanish.
        await append(memory)
        // `isReadable`, as a rebuild filters: a memory written as dropped must not be listed
        // until a restart and vanish afterwards.
        if (isReadable(memory)) index.put(memory)
        return memory
      }),

    amend: (id, patch) =>
      writes.next(async () => {
        const held = index.read(id)
        if (held === null) return null

        const amended: Memory = { ...held, ...patch }
        await append(amended)
        if (isReadable(amended)) index.put(amended)
        else index.remove(amended.id)
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

    refresh: () =>
      writes.next(async () =>
        hasMoved(index.stamp(), await stampOf(file)) ? await readFileInto() : index.count(),
      ),

    reset: () =>
      writes.next(async () => {
        index.clear()
        trouble = null
        await rm(file, { force: true })
      }),

    trouble: () => trouble,

    // Settled BEFORE the database shuts: what is queued is an append to the file the next launch
    // reads back, and a driver closed under it loses the line without a word.
    close: async () => {
      await writes.settled()
      index.close()
    },
  }
}

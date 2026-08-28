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
import { isMissing, writeAtomic, writeQueue } from '@main/persistence'
import type { MemoryIndex, MemoryStamp, RecallAsk } from './memoryIndex'
import type { MemoryVector, PendingVector } from './vectors'
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
  /**
   * How many memories stand, without reading one.
   *
   * 🛑 One `count(*)` against a recall's embedding and vector scan — `[M]` 11 ms and 3 ms for 208
   * memories. It is what the briefing pays to say a memory exists at all; the recall itself is
   * paid only by a model that asks for it.
   */
  count: () => Promise<number>
  markUsed: (ids: readonly string[]) => Promise<void>
  /**
   * The embeddings, which live in the index alone and never in the file.
   *
   * By ADR-24's criterion, the same one that keeps `usedAt` out: a vector is what one model on
   * one machine computed, so it says nothing about the project and does not travel with it. It
   * costs a recomputation on another machine, and a recomputation is what a derived index is for.
   *
   * 🛑 No reader across this boundary. `[M]` reading 10 000 vectors of 768 dimensions costs 78 ms
   * and 30 MB, and a structured clone would pay both again — what compares them belongs on the
   * side that holds them.
   */
  recall: (ask: RecallAsk) => Promise<readonly Memory[]>
  writeVectors: (vectors: readonly MemoryVector[]) => Promise<void>
  withoutVector: (model: string, limit: number) => Promise<readonly PendingVector[]>
  pendingVectors: (model: string) => Promise<number>
  dropOtherVectors: (model: string) => Promise<void>
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
  /**
   * Rewrites the file with one line per memory that still stands, dropping every amendment and
   * every forgetting the log holds. Answers how many lines it saved.
   *
   * 🛑 What is `dropped` goes for good, and it is the one gesture that loses anything: the file
   * is append-only precisely so nothing else does. An `archived` memory is KEPT — archiving is
   * a state, forgetting is a removal, and compaction is what finally carries the second out.
   */
  compact: () => Promise<number>
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
async function stampOf(file: string): Promise<MemoryStamp | null> {
  const stats = await orElse(stat(file), null)
  return stats && { bytes: stats.size, modifiedAt: Math.trunc(stats.mtimeMs) }
}

/** How many memories the file spells, amendments and forgettings included. */
async function linesIn(file: string): Promise<number> {
  const body = await orElse(readFile(file, 'utf8'), '')
  return body.split('\n').filter(line => line.trim().length > 0).length
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

/** The same memory, out of every recall. Named so the state is a declared type, not an `as const`. */
const archivedOf = (memory: Memory): Memory => ({ ...memory, state: 'archived' })

/**
 * What this draft replaces: a memory of the same TYPE anchored on the same first reference.
 *
 * The first reference and not any of them: a script memory is about its file, and a memory
 * naming a scene as well must not be superseded by every other memory of that scene.
 */
function supersededBy(index: MemoryIndex, draft: MemoryDraft): Memory | null {
  const anchor = draft.refs?.[0]
  return anchor ? index.standingOn(draft.type, anchor) : null
}

export function createMemoryStore({ file, index, now, newId }: MemoryStoreDeps): MemoryStore {
  const writes = writeQueue()
  let trouble: MemoryTrouble | null = null
  // 🛑 Whether THIS session has read the file. `trouble` is set by `readFileInto` alone, and an
  // opening whose stamp had not moved never calls it — see `compact`, which the difference costs.
  let readHere = false
  // Made once rather than on every append: a recursive `mkdir` on a folder that is already there
  // measured 61 µs against the 140 µs the append itself costs.
  let folder: Promise<unknown> | null = null

  const append = async (...memories: readonly Memory[]): Promise<void> => {
    try {
      folder ??= mkdir(dirname(file), { recursive: true })
      await folder
    } catch (error) {
      // Forgotten so the next write tries again: a folder removed under a running studio, or a
      // volume that blinked, must not stop this memory persisting for the rest of the session.
      folder = null
      throw error
    }
    await appendFile(file, memories.map(lineOf).join(''), 'utf8')

    const stamp = await stampOf(file)
    if (stamp) index.restamp(stamp)
  }

  /**
   * The file, applied line by line, latest wins. A memory written three times is held once, as
   * its last line describes it — that is what makes an append-only file a store rather than a log.
   */
  const readFileInto = async (): Promise<number> => {
    trouble = null
    readHere = true

    let body: string
    try {
      body = await readFile(file, 'utf8')
    } catch (error) {
      // A project that never remembered anything is the ordinary case, not a fault.
      if (isMissing(error)) {
        index.clear()
        // Swept: no file is no memories, so every vector held is an orphan.
        index.sweepVectors()
        return 0
      }
      // Emptied as well: answering `0` to the window while `list` still served the old rows had
      // the panel told « nothing » and showing something.
      trouble = 'unreadable'
      index.clear()
      // 🛑 NOT swept, unlike the two other emptyings: a volume that blinked would otherwise cost
      // a full re-embedding — 24 ms a memory — for a file the next read finds intact.
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
    const served = index.served()
    const standing = [...held.values()]
      .filter(isReadable)
      .map(memory => ({ ...memory, ...defined({ usedAt: served.get(memory.id) }) }))

    index.clear()
    index.putAll(standing)
    // AFTER the file has been read whole: `clear` spares the vectors on purpose, so what is an
    // orphan is only known once every line that still stands has been put back.
    index.sweepVectors()

    const stamp = await stampOf(file)
    if (stamp) index.restamp(stamp)

    return standing.length
  }

  return {
    remember: draft =>
      writes.next(async () => {
        /**
         * 🛑 What a memory REPLACES, rather than what it adds beside. A rule that fires twice on
         * one script would otherwise leave two memories contradicting each other, with nothing
         * saying which is now — and both would be recalled.
         */
        const replaced = supersededBy(index, draft)

        const memory: Memory = {
          ...draft,
          id: newId(),
          body: draft.body ?? '',
          createdAt: now(),
          refs: draft.refs ?? [],
          links: draft.links ?? [],
          state: draft.state ?? 'live',
          ...defined({ supersedes: replaced?.id }),
        }

        // The file first, always: an index holding what the file does not is an index that
        // answers a memory a restart makes vanish.
        /**
         * 🛑 ONE append for both lines. Written in two, an `ENOSPC` between them left the
         * replaced memory archived with nothing standing in its place — out of every recall,
         * and nothing saying why.
         */
        const archived = replaced && archivedOf(replaced)
        await append(...(archived ? [archived, memory] : [memory]))
        if (archived) index.put(archived)
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

    count: async () => index.count(),

    markUsed: async ids => index.markUsed(ids, now()),

    recall: async ask => index.recall(ask),

    writeVectors: async vectors => index.writeVectors(vectors),

    withoutVector: async (model, limit) => index.withoutVector(model, limit),

    pendingVectors: async model => index.pendingVectors(model),

    dropOtherVectors: async model => index.dropOtherVectors(model),

    rebuild: () => writes.next(readFileInto),

    refresh: () =>
      writes.next(async () =>
        hasMoved(index.stamp(), await stampOf(file)) ? await readFileInto() : index.count(),
      ),

    compact: () =>
      writes.next(async () => {
        /**
         * 🛑 Read back FIRST when this session has not, and only then refused. A `too-new` line is
         * kept out of the index and sets `trouble`; but an opening whose stamp had not moved never
         * reads, so `trouble` is null on the next launch over the very same file — and the rewrite
         * below would then erase a later studio's memories while reporting them as lines saved.
         */
        if (!readHere) await readFileInto()
        if (trouble !== null) return 0

        // Read back FIRST: the index holds no `dropped` line and no superseded one, so it cannot
        // say how many lines the file carries — only the file can.
        const before = await linesIn(file)
        if (before === 0) return 0

        const standing = index.list({ limit: Number.MAX_SAFE_INTEGER })
        // Atomic, unlike every other write here: this one REPLACES the file, and a process that
        // died mid-write would leave a project's whole memory truncated.
        await writeAtomic(file, standing.map(lineOf).join(''))

        const stamp = await stampOf(file)
        if (stamp) index.restamp(stamp)

        return Math.max(0, before - standing.length)
      }),

    reset: () =>
      writes.next(async () => {
        index.clear()
        // Swept: this is the gesture that means « forget all of it », vectors included.
        index.sweepVectors()
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

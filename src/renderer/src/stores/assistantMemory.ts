import { create } from 'zustand'
import type {
  Memory,
  MemoryDraft,
  MemoryIndexing,
  MemoryPatch,
  MemoryQuery,
  MemoryScope,
} from '@shared/domain/assistantMemory'
import { duplicatesIn, staleIn } from '@shared/domain/memoryUpkeep'
import { orElse } from '@shared/promises'
import { connectThroughBridge, memoryBridge } from '@/services/bridge'

/**
 * One amendment, against a scope the caller NAMES — what a burst holds on to while the person is
 * free to move the pill. `orElse` and not `!== null`: with no bridge the call answers `undefined`,
 * and a window was told its amendment had gone through.
 */
const amendedIn = async (scope: MemoryScope, id: string, patch: MemoryPatch): Promise<boolean> =>
  (await orElse(memoryBridge()?.amend(scope, id, patch), null)) !== null

/**
 * What the window holds of the two memories.
 *
 * A listing rather than the whole of either: the file may hold years of a project, and nothing on
 * screen ever wants all of it at once — see `MEMORY_PAGE`.
 */
type AssistantMemoryState = {
  memories: readonly Memory[]
  scope: MemoryScope
  query: MemoryQuery
  /** Told apart from « none held »: a panel drawn before the first answer must not say « empty ». */
  loaded: boolean
  connect: () => Promise<() => void>
  look: (scope: MemoryScope, query: MemoryQuery) => Promise<void>
  reload: () => Promise<void>
  remember: (draft: MemoryDraft) => Promise<Memory | null>
  amend: (id: string, patch: MemoryPatch) => Promise<boolean>
  forget: (id: string) => Promise<boolean>
  /** Reads the file back and rebuilds the index. Answers how many memories stand once it has. */
  rebuild: () => Promise<number>
  /** Everything forgotten, the file included. The one gesture that erases rather than writes. */
  reset: () => Promise<void>
  /**
   * Keeps the best of each group of duplicates, links the rest to it and archives them.
   *
   * Archived and not forgotten: what said the same thing twice still says where it came from,
   * and merging is a tidying, not a judgement about what was true.
   */
  mergeDuplicates: () => Promise<number>
  /** Archives what nothing has drawn on for a season. Pinned memories are never touched. */
  archiveStale: (now: string) => Promise<number>
  /** Rewrites the file with one line per standing memory. Answers how many lines it saved. */
  compact: () => Promise<number>
  /** How many memories have no vector yet, and how far a run has got. `null` while none has. */
  pending: number
  indexing: MemoryIndexing | null
  /** Starts computing what is missing, in the background, and follows it. */
  index: () => Promise<void>
  stopIndex: () => Promise<void>
}

export const useAssistantMemory = create<AssistantMemoryState>()((set, get) => ({
  memories: [],
  scope: 'project',
  query: {},
  loaded: false,
  pending: 0,
  indexing: null,

  connect: connectThroughBridge(async bridge => {
    // Every window follows every write: two replicas of one file is one too many, and a memory
    // written by the assistant in one window belongs on screen in the other.
    // 🛑 Reloaded only once the panel has ASKED. Subscribing costs nothing; reading opens a
    // thread and a database, and the settings window connects this from its root — so a change
    // announced while the reader is on another section must not pay for one.
    const stopChanges = bridge.memory.onChanged(scope => {
      if (scope === get().scope && get().loaded) void get().reload()
    })
    const stopSteps = bridge.memory.onIndexed(progress => {
      if (progress.scope !== get().scope) return

      // Cleared at the end rather than left showing « 40 / 40 »: a bar that never goes away is
      // a bar that stops meaning « something is happening ».
      const done = progress.done >= progress.total
      set({ indexing: done ? null : progress, pending: progress.total - progress.done })
    })
    return () => {
      stopChanges()
      stopSteps()
    }
  }),

  look: async (scope, query) => {
    set({ scope, query })
    await get().reload()
  },

  reload: async () => {
    const { scope, query } = get()
    // Cleared first: a scope just changed leaves the OTHER scope's rows on screen, and `loaded`
    // saying true about them is a panel claiming they are the answer.
    set({ loaded: false })

    const memories = await orElse(memoryBridge()?.list(scope, query), [])

    // 🛑 Dropped when the question moved on: two reads in flight — a scope switch, or a write
    // announced mid-switch — can settle out of order, and the slower one would paint the other
    // scope's rows and call them loaded.
    if (get().scope !== scope || get().query !== query) return

    set({ memories, loaded: true, pending: await orElse(memoryBridge()?.pending(scope), 0) })
  },

  // No optimistic write, unlike the context panel: the id and the date come from the main
  // process, so there is nothing truthful to draw before the answer arrives.
  remember: async draft => await orElse(memoryBridge()?.remember(get().scope, draft), null),

  /**
   * Reloaded here rather than left to the change event: the panel is what shows the row, and a
   * pinned memory still offering « Pin » is the whole gesture failing in front of the person.
   */
  amend: async (id, patch) => {
    const amended = await amendedIn(get().scope, id, patch)
    if (amended) await get().reload()
    return amended
  },

  forget: async id => {
    const forgotten = await orElse(memoryBridge()?.forget(get().scope, id), false)
    if (forgotten) await get().reload()
    return forgotten
  },

  rebuild: async () => await orElse(memoryBridge()?.rebuild(get().scope), 0),

  reset: async () => {
    await orElse(memoryBridge()?.reset(get().scope), undefined)
  },

  /**
   * 🛑 The scope is read ONCE, and `amendedIn` is what makes that possible: `amend` reads
   * `get().scope` on every call, so moving the pill mid-run sent the rest of the burst at the
   * other memory — where the ids do not exist, so nothing was written wrongly, but the merge
   * stopped half done and reported a figure that was not true.
   *
   * One reload at the end and not one per memory, for the same reason.
   */
  mergeDuplicates: async () => {
    const scope = get().scope
    let merged = 0
    for (const group of duplicatesIn(get().memories)) {
      const [keeper, ...rest] = group
      if (!keeper) continue

      for (const one of rest) {
        // Linked BEFORE it is archived, so what was tidied away still says what it stood beside.
        const patch: MemoryPatch = { state: 'archived', links: [...one.links, keeper.id] }
        if (await amendedIn(scope, one.id, patch)) merged += 1
      }
    }

    await get().reload()
    return merged
  },

  archiveStale: async now => {
    const scope = get().scope
    let archived = 0
    for (const one of staleIn(get().memories, now)) {
      if (await amendedIn(scope, one.id, { state: 'archived' })) archived += 1
    }

    await get().reload()
    return archived
  },

  compact: async () => await orElse(memoryBridge()?.compact(get().scope), 0),

  index: async () => {
    await orElse(memoryBridge()?.index(get().scope), undefined)
  },

  stopIndex: async () => {
    await orElse(memoryBridge()?.stopIndex(get().scope), undefined)
  },
}))

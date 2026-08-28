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
import { connectThroughBridge, getBridge } from '@/services/bridge'

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
    const stopChanges = bridge.memory.onChanged(scope => {
      if (scope === get().scope) void get().reload()
    })
    const stopSteps = bridge.memory.onIndexed(progress => {
      if (progress.scope !== get().scope) return

      // Cleared at the end rather than left showing « 40 / 40 »: a bar that never goes away is
      // a bar that stops meaning « something is happening ».
      const done = progress.done >= progress.total
      set({ indexing: done ? null : progress, pending: progress.total - progress.done })
    })
    await get().reload()
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

    const memories = await orElse(getBridge()?.memory.list(scope, query), [])

    // 🛑 Dropped when the question moved on: two reads in flight — a scope switch, or a write
    // announced mid-switch — can settle out of order, and the slower one would paint the other
    // scope's rows and call them loaded.
    if (get().scope !== scope || get().query !== query) return

    set({ memories, loaded: true })
    set({ pending: await orElse(getBridge()?.memory.pending(scope), 0) })
  },

  // No optimistic write, unlike the context panel: the id and the date come from the main
  // process, so there is nothing truthful to draw before the answer arrives.
  remember: async draft => await orElse(getBridge()?.memory.remember(get().scope, draft), null),

  // 🛑 `orElse` and not `!== null`: with no bridge the call answers `undefined`, and a window
  // was told its amendment had gone through.
  amend: async (id, patch) =>
    (await orElse(getBridge()?.memory.amend(get().scope, id, patch), null)) !== null,

  forget: async id => await orElse(getBridge()?.memory.forget(get().scope, id), false),

  rebuild: async () => await orElse(getBridge()?.memory.rebuild(get().scope), 0),

  reset: async () => {
    await orElse(getBridge()?.memory.reset(get().scope), undefined)
  },

  mergeDuplicates: async () => {
    let merged = 0
    for (const group of duplicatesIn(get().memories)) {
      const [keeper, ...rest] = group
      if (!keeper) continue

      for (const one of rest) {
        // Linked BEFORE it is archived, so what was tidied away still says what it stood beside.
        if (await get().amend(one.id, { state: 'archived', links: [...one.links, keeper.id] })) {
          merged += 1
        }
      }
    }

    await get().reload()
    return merged
  },

  archiveStale: async now => {
    let archived = 0
    for (const one of staleIn(get().memories, now)) {
      if (await get().amend(one.id, { state: 'archived' })) archived += 1
    }

    await get().reload()
    return archived
  },

  compact: async () => await orElse(getBridge()?.memory.compact(get().scope), 0),

  index: async () => {
    await orElse(getBridge()?.memory.index(get().scope), undefined)
  },

  stopIndex: async () => {
    await orElse(getBridge()?.memory.stopIndex(get().scope), undefined)
  },
}))

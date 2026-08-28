import { create } from 'zustand'
import type {
  Memory,
  MemoryDraft,
  MemoryPatch,
  MemoryQuery,
  MemoryScope,
} from '@shared/domain/assistantMemory'
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
}

export const useAssistantMemory = create<AssistantMemoryState>()((set, get) => ({
  memories: [],
  scope: 'project',
  query: {},
  loaded: false,

  connect: connectThroughBridge(async bridge => {
    // Every window follows every write: two replicas of one file is one too many, and a memory
    // written by the assistant in one window belongs on screen in the other.
    const stop = bridge.memory.onChanged(scope => {
      if (scope === get().scope) void get().reload()
    })
    await get().reload()
    return stop
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
  },

  // No optimistic write, unlike the context panel: the id and the date come from the main
  // process, so there is nothing truthful to draw before the answer arrives.
  remember: async draft => await orElse(getBridge()?.memory.remember(get().scope, draft), null),

  // 🛑 `orElse` and not `!== null`: with no bridge the call answers `undefined`, and a window
  // was told its amendment had gone through.
  amend: async (id, patch) =>
    (await orElse(getBridge()?.memory.amend(get().scope, id, patch), null)) !== null,

  forget: async id => await orElse(getBridge()?.memory.forget(get().scope, id), false),
}))

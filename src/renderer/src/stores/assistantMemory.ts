import { create } from 'zustand'
import type {
  Memory,
  MemoryDraft,
  MemoryPatch,
  MemoryQuery,
  MemoryScope,
} from '@shared/domain/assistantMemory'
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
    set({ memories: (await getBridge()?.memory.list(scope, query)) ?? [], loaded: true })
  },

  // No optimistic write, unlike the context panel: the id and the date come from the main
  // process, so there is nothing truthful to draw before the answer arrives.
  remember: async draft => (await getBridge()?.memory.remember(get().scope, draft)) ?? null,

  amend: async (id, patch) => (await getBridge()?.memory.amend(get().scope, id, patch)) !== null,

  forget: async id => (await getBridge()?.memory.forget(get().scope, id)) ?? false,
}))

/** The memories of one type, for a panel that groups them. Named for its domain — see CLAUDE.md. */
export function memoriesOfType(
  state: Pick<AssistantMemoryState, 'memories'>,
  type: Memory['type'],
): readonly Memory[] {
  return state.memories.filter(memory => memory.type === type)
}

/** Whether anything is pinned, which is what a panel says before it draws a « pinned » group. */
export function hasPinnedMemory(state: Pick<AssistantMemoryState, 'memories'>): boolean {
  return state.memories.some(memory => memory.state === 'pinned')
}

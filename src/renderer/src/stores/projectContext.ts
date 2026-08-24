import { orElse } from '@shared/promises'
import { create } from 'zustand'
import {
  composedContext,
  noContext,
  type ContextCard,
  type ContextState,
} from '@shared/domain/projectContext'
import { connectThroughBridge, getBridge } from '@/services/bridge'

type ProjectContextState = {
  context: ContextState
  /** Follows what any window writes, and reads the file once. Returns the unsubscribe. */
  connect: () => Promise<() => void>
  /** Re-reads it from scratch. The file belongs to a project, so opening one replaces it. */
  reload: () => Promise<void>
  /** Stores the whole list. Answers false when the file refused to be written over. */
  write: (cards: readonly ContextCard[]) => Promise<boolean>
}

/** Owned by the main process, replicated here, refreshed by the event every write pushes. */
export const useProjectContext = create<ProjectContextState>()((set, get) => ({
  context: noContext(),

  connect: connectThroughBridge(async bridge => {
    const stop = bridge.project.onContextChanged(context => set({ context }))
    await get().reload()
    return stop
  }),

  reload: async () => {
    set({ context: (await getBridge()?.project.readContext()) ?? noContext() })
  },

  /**
   * 🛑 Held HERE before the round trip, and that is not cosmetic: two gestures in a row — a body
   * typed then a card switched off — both compose from the list they read, and the second read a
   * list the first had not yet been allowed to change. The edit in between was lost.
   */
  write: async cards => {
    const bridge = getBridge()
    if (!bridge) return false

    const before = get().context
    set({ context: { ...before, cards } })

    // Refused rather than thrown on: the one refusal that reaches here is a file this build will
    // not overwrite, so what it holds — not what this window hoped — is what stays on screen.
    const written = await orElse(bridge.project.writeContext(cards), null)
    set({ context: written ?? before })

    return written !== null
  },
}))

/** What a generation carries, and what the panel previews. Empty when nothing is on. */
export function projectContextText(state: ProjectContextState): string {
  return composedContext(state.context.cards)
}

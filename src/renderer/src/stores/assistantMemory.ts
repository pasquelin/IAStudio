import { create } from 'zustand'
import type {
  Memory,
  MemoryDraft,
  MemoryIndexing,
  MemoryPatch,
  MemoryQuery,
  MemoryScope,
} from '@shared/domain/assistantMemory'
import { MEMORY_PAGE } from '@shared/domain/assistantMemory'
import { alreadySaid, duplicatesIn, staleIn } from '@shared/domain/memoryUpkeep'
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
 * 🛑 Whether an upkeep burst is running, and it is what makes « one reload at the end » true.
 *
 * The main process broadcasts a change per amendment and this window hears its OWN: a merge of a
 * hundred memories set off a full listing per amendment, in every open window, for a result one
 * final read describes. Held at the module rather than in the state: it must not draw anything.
 */
let bursting = false

/** Runs a burst with its own announcements muted, and lets them through again whatever happens. */
async function burst<T>(run: () => Promise<T>): Promise<T> {
  bursting = true
  try {
    return await run()
  } finally {
    bursting = false
  }
}

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
  /** Whether the panel has asked once — what makes `pending` a read per SCOPE, not per keystroke. */
  asked: boolean
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
  /**
   * Copies one memory of a project into the machine's own, so it serves every project.
   *
   * 🛑 The ONE way anything reaches the machine's memory, and it is a gesture the person makes:
   * no automatic rule and no MCP client writes there, or one project's habits would land in what
   * follows the person everywhere. Answers false when there was nothing to copy.
   */
  promote: (memory: Memory) => Promise<boolean>
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
  asked: false,
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
      if (bursting || scope !== get().scope || !get().loaded) return
      void get().reload()
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
    // The bar belongs to the scope that was showing: a run under way in the other one is not
    // this panel's business, and `onIndexed` filters on the scope anyway.
    const moved = scope !== get().scope
    set({ scope, query, ...(moved ? { indexing: null } : {}) })
    await get().reload()
    // Here and not in `reload`: what is left to embed belongs to the SCOPE, so it is read when
    // the scope changes and when the panel first asks — never on a filter the count ignores.
    if (moved || !get().asked) {
      set({ asked: true, pending: await orElse(memoryBridge()?.pending(scope), 0) })
    }
  },

  reload: async () => {
    const { scope, query } = get()
    // Cleared first: a scope just changed leaves the OTHER scope's rows on screen, and `loaded`
    // saying true about them is a panel claiming they are the answer.
    set({ loaded: false })

    /**
     * 🛑 The listing alone. `pending` is a `LEFT JOIN` over EVERY memory of the scope and does
     * not depend on the query, so counting it here made each keystroke of the search pay a scan
     * whose answer could not have moved. It is read when the scope does — see `look` — and
     * published live by `onIndexed` while a run is going.
     */
    const memories = await orElse(memoryBridge()?.list(scope, query), [])

    // 🛑 Dropped when the question moved on: two reads in flight — a scope switch, or a write
    // announced mid-switch — can settle out of order, and the slower one would paint the other
    // scope's rows and call them loaded.
    if (get().scope !== scope || get().query !== query) return

    set({ memories, loaded: true })
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
    const merged = await burst(async () => {
      let done = 0
      for (const group of duplicatesIn(get().memories)) {
        const [keeper, ...rest] = group
        if (!keeper) continue

        for (const one of rest) {
          // Linked BEFORE it is archived, so what was tidied away still says what it stood beside.
          // `linkTo` and not `links`: the union is computed in the store, over what stands there.
          const patch: MemoryPatch = { state: 'archived', linkTo: [keeper.id] }
          if (await amendedIn(scope, one.id, patch)) done += 1
        }
      }
      return done
    })

    await get().reload()
    return merged
  },

  archiveStale: async now => {
    const scope = get().scope
    const archived = await burst(async () => {
      let done = 0
      for (const one of staleIn(get().memories, now)) {
        if (await amendedIn(scope, one.id, { state: 'archived' })) done += 1
      }
      return done
    })

    await get().reload()
    return archived
  },

  promote: async memory => {
    // Read from the machine's own, never from what is on screen: the panel is showing a project.
    const standing = await orElse(memoryBridge()?.list('global', { limit: MEMORY_PAGE }), [])
    if (alreadySaid(standing, memory)) return true

    /**
     * 🛑 Neither `refs` nor `links` travel. A ref is a path or an id INSIDE the project, which
     * names nothing once the project is closed — and `supersededBy` picks what a draft replaces
     * by its first ref, so carrying one would have a promoted memory replace another over a path
     * that means nothing there. What travels is what was learned, not where it was learned.
     */
    const written = await orElse(
      memoryBridge()?.remember('global', {
        type: memory.type,
        summary: memory.summary,
        importance: memory.importance,
        // The person decided this one follows them, whoever first wrote it down.
        source: { kind: 'person' },
        ...(memory.body === '' ? {} : { body: memory.body }),
      }),
      null,
    )

    return written !== null
  },

  compact: async () => await orElse(memoryBridge()?.compact(get().scope), 0),

  index: async () => {
    await orElse(memoryBridge()?.index(get().scope), undefined)
  },

  stopIndex: async () => {
    await orElse(memoryBridge()?.stopIndex(get().scope), undefined)
    // 🛑 Cleared HERE: an aborted run leaves `sweep`'s loop without a last `onProgress`, so no
    // event ever says it ended — and the panel offered Stop for the rest of the session, with
    // Embed unreachable behind it.
    set({ indexing: null })
  },
}))

import { create } from 'zustand'
import {
  ACTIVITY_RETENTION,
  matchesActivity,
  type ActivityEntry,
  type ActivityLevel,
  type ActivityTopic,
} from '@shared/domain/activity'
import { getBridge } from '@/services/bridge'

/**
 * How many failures the studio shows at once before it stops stacking them.
 *
 * A burst is one thing going wrong many times — a key that expired mid-push is forty lines and
 * one problem. Past this, the toasts would cover the work they are reporting on.
 */
const TOAST_LIMIT = 3

type ActivityState = {
  entries: ActivityEntry[]
  levels: ActivityLevel[]
  topics: ActivityTopic[]
  /** Failures the user has not acknowledged yet — what the toasts show. */
  unread: ActivityEntry[]

  /** Reads the journal back and follows what is written to it. Returns the unsubscribe. */
  connect: () => Promise<() => void>
  reload: () => Promise<void>
  append: (entries: readonly ActivityEntry[]) => void
  setLevels: (levels: readonly ActivityLevel[]) => void
  setTopics: (topics: readonly ActivityTopic[]) => void
  dismiss: (id: number) => void
  dismissAll: () => void
}

/**
 * The journal as the window sees it: owned by the main process, replicated here so the panel
 * renders without asking, and refreshed by the events the main process pushes.
 *
 * Filters live here rather than in the panel: the panel is unmounted whenever its flyout is
 * closed, and filters that reset on every open are filters nobody would set twice.
 */
export const useActivity = create<ActivityState>()((set, get) => ({
  entries: [],
  levels: [],
  topics: [],
  unread: [],

  connect: async () => {
    const bridge = getBridge()
    if (!bridge) return () => {}

    const stop = bridge.activity.onEntries(entries => get().append(entries))
    await get().reload()
    return stop
  },

  reload: async () => {
    const bridge = getBridge()
    if (!bridge) return

    // Unfiltered: the panel filters what it holds, so changing a filter costs no round trip and
    // the toasts still see a failure the current filter would have hidden.
    set({ entries: await bridge.activity.read({ limit: ACTIVITY_RETENTION }) })
  },

  // Prepended rather than refetched: the batch that just arrived IS the newest, and re-reading
  // would throw away the list the panel is scrolled through.
  append: entries =>
    set(state => ({
      entries: [...[...entries].reverse(), ...state.entries].slice(0, ACTIVITY_RETENTION),
      unread: [...entries.filter(entry => entry.level === 'error'), ...state.unread].slice(
        0,
        TOAST_LIMIT,
      ),
    })),

  setLevels: levels => set({ levels: [...levels] }),
  setTopics: topics => set({ topics: [...topics] }),

  dismiss: id => set(state => ({ unread: state.unread.filter(entry => entry.id !== id) })),
  dismissAll: () => set({ unread: [] }),
}))

/** What the panel draws, once its filters have had their say. */
export function visibleActivity(state: ActivityState): ActivityEntry[] {
  return state.entries.filter(entry =>
    matchesActivity(entry, { levels: state.levels, topics: state.topics }),
  )
}

/** What the status line counts: failures, which are the reason the journal exists. */
export function failureCount(state: ActivityState): number {
  return state.entries.filter(entry => entry.level === 'error').length
}

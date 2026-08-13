import { create } from 'zustand'
import {
  ACTIVITY_WINDOW,
  boundedToasts,
  isToastWorthy,
  matchesActivity,
  type ActivityEntry,
  type ActivityFilter,
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
  /** What the toasts show, and the user has not dismissed yet — see `isToastWorthy`. */
  unread: ActivityEntry[]

  /** Reads the journal back and follows what is written to it. Returns the unsubscribe. */
  connect: () => Promise<() => void>
  /** Re-reads it from scratch. The journal belongs to a project, so opening one replaces it. */
  reload: () => Promise<void>
  append: (entries: readonly ActivityEntry[]) => void
  setFilters: (filters: Partial<ActivityFilters>) => void
  dismiss: (id: number) => void
  dismissAll: () => void
}

type ActivityFilters = { levels: ActivityLevel[]; topics: ActivityTopic[] }

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
    set({ entries: (await getBridge()?.activity.read({ limit: ACTIVITY_WINDOW })) ?? [] })
  },

  // Prepended rather than refetched: the batch that just arrived IS the newest, and re-reading
  // would throw away the list the panel is scrolled through.
  append: entries =>
    set(state => ({
      entries: [...[...entries].reverse(), ...state.entries].slice(0, ACTIVITY_WINDOW),
      unread: boundedToasts([...entries.filter(isToastWorthy), ...state.unread], TOAST_LIMIT),
    })),

  // One write for both axes: clearing the filters used to be two, and two renders for one click.
  setFilters: filters => set(filters),

  dismiss: id => set(state => ({ unread: state.unread.filter(entry => entry.id !== id) })),
  dismissAll: () => set({ unread: [] }),
}))

/**
 * What the panel draws, once its filters have had their say.
 *
 * NOT a zustand selector: it derives a fresh array, and zustand compares snapshots by identity —
 * passed to the hook it renders, derives again, and renders again, until React gives up. The
 * panel reads the raw slices and memoises this itself.
 */
export function visibleActivity(
  entries: readonly ActivityEntry[],
  filters: ActivityFilter,
): ActivityEntry[] {
  return entries.filter(entry => matchesActivity(entry, filters))
}

/** What the status line counts: failures, which are the reason the journal exists. */
export function failureCount(state: ActivityState): number {
  // Counted rather than filtered: this runs on every write to the store, including the ones
  // that touch nothing but the toasts, and the intermediate array was pure allocation.
  let count = 0
  for (const entry of state.entries) if (entry.level === 'error') count++
  return count
}

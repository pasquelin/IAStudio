import { create } from 'zustand'
import { mergePartial, type PartialSettings } from '@shared/domain/settings'
import {
  partialFor,
  valueAt,
  type SettingPath,
  type SettingValue,
} from '@shared/domain/settings-path'
import { useSettings } from './settings'

type DraftState = {
  /** What Apply would write. Empty means nothing is waiting. */
  pending: PartialSettings
  /**
   * Which leaves were touched. Distinct from `pending` because a value put back to what it was
   * is still a modification until it is applied — without this the row would lose its mark
   * halfway through an edit.
   */
  touched: ReadonlySet<SettingPath>

  /** Stages one leaf. Nothing outside this store has to know how a path becomes a partial. */
  stage: (path: SettingPath, value: SettingValue | undefined) => void
  /** Stages what no path can express — the default model of a family, say. */
  stageBranch: (partial: PartialSettings) => void
  apply: () => Promise<void>
  cancel: () => void
}

/**
 * The editing buffer of the settings window: nothing is written until Apply.
 *
 * It lives beside the replicated settings rather than inside them, because it belongs to ONE
 * window — every other window replicates what is stored, and none of them has any business
 * seeing what is being typed here.
 */
export const useSettingsDraft = create<DraftState>()((set, get) => ({
  pending: {},
  touched: new Set(),

  stage: (path, value) =>
    set(state => ({
      pending: mergePartial(state.pending, partialFor(path, value)),
      touched: new Set(state.touched).add(path),
    })),

  stageBranch: partial => set(state => ({ pending: mergePartial(state.pending, partial) })),

  apply: async () => {
    const { pending } = get()
    if (!isDraftDirty(get())) return

    // Cleared before the write rather than after: the write comes back as a broadcast, and a
    // buffer still holding the same values would keep every row marked as modified.
    set({ pending: {}, touched: new Set() })
    await useSettings.getState().write(pending)
  },

  cancel: () => set({ pending: {}, touched: new Set() }),
}))

/**
 * Whether anything is waiting. Both halves matter: `touched` carries the leaves, and `pending`
 * alone carries what a bespoke screen staged through `stageBranch` — a default model staged and
 * no Apply button to write it with was exactly that gap.
 */
export function isDraftDirty(state: Pick<DraftState, 'pending' | 'touched'>): boolean {
  return state.touched.size > 0 || Object.keys(state.pending).length > 0
}

/**
 * What a control shows: the staged value where one was staged, the stored one everywhere else.
 *
 * This is also the collision rule with the other windows: a write landing from elsewhere moves
 * `settings` underneath, and the buffer keeps only the leaves it was actually given.
 */
export function valueOf(
  draft: Pick<DraftState, 'pending' | 'touched'>,
  stored: SettingValue | undefined,
  path: SettingPath,
): SettingValue | undefined {
  return draft.touched.has(path) ? valueAt(draft.pending, path) : stored
}

/**
 * The value one control shows, and the ONLY place the rule above is applied — a row rewriting
 * it inline is how the two drift apart.
 *
 * Three primitive selectors rather than one over each store: the buffer changes on every
 * keystroke anywhere in the window, and a row must only re-render for its own leaf.
 */
export function useSettingValue(path: SettingPath | undefined): SettingValue | undefined {
  const stored = useSettings(state => (path ? valueAt(state.settings, path) : undefined))
  // `path` may be absent — a row with no dependency reads nothing — and a hook cannot be called
  // conditionally, so the absence is handled here rather than at each call site.
  const staged = useSettingsDraft(state => (path ? state.touched.has(path) : false))
  const pending = useSettingsDraft(state => (path ? valueAt(state.pending, path) : undefined))

  return staged ? pending : stored
}

import { create } from 'zustand'

/**
 * What the inspector is looking at.
 *
 * A clip carries no id here on purpose: the sequence already holds `selectedId`, the canvas
 * paints from it, and a second copy would be one more thing that can disagree with the first.
 * This says which KIND of thing is being inspected; the owning store says which one.
 */
export type Selection =
  | { kind: 'none' }
  | { kind: 'asset'; ids: string[] }
  | { kind: 'clip' }
  | { kind: 'track'; id: string }

type SelectionState = {
  selection: Selection
  selectAssets: (ids: string[]) => void
  selectClip: () => void
  selectTrack: (id: string) => void
  clear: () => void
}

const NONE: Selection = { kind: 'none' }

/**
 * Selection is not focus and not what is open: clicking selects, double-clicking opens. It is
 * global rather than per document because one inspector serves every panel — the asset shelf,
 * the montage and the track headers all point it at what was touched last.
 */
export const useSelection = create<SelectionState>()(set => ({
  selection: NONE,

  selectAssets: ids => set({ selection: ids.length > 0 ? { kind: 'asset', ids } : NONE }),

  // Guarded: the canvas re-selects the same clip on every pointer down of a drag, and an
  // unguarded write would re-render the inspector on each of them.
  selectClip: () =>
    set(state => (state.selection.kind === 'clip' ? state : { selection: { kind: 'clip' } })),

  selectTrack: id =>
    set(state =>
      state.selection.kind === 'track' && state.selection.id === id
        ? state
        : { selection: { kind: 'track', id } },
    ),

  clear: () => set(state => (state.selection.kind === 'none' ? state : { selection: NONE })),
}))

import { create } from 'zustand'

/**
 * What the inspector is looking at: what kind of thing, which document holds it, and which
 * ones were picked.
 *
 * The owner is carried rather than looked up. "The active sequence" is not the same question
 * as "the sequence this was selected in", and the default tracks are called `V1` and `A1` in
 * every sequence there is — so a track picked in one tab, read back after switching to
 * another, described a different track of the same name without saying so.
 *
 * An asset belongs to the project rather than to a document, so its owner is null. The shape
 * stays the same all the same: one descriptor to read, not four to tell apart.
 */
export type Selection =
  | { kind: 'none' }
  | { kind: 'asset'; ownerId: null; ids: string[] }
  | { kind: 'clip'; ownerId: string; ids: string[] }
  | { kind: 'track'; ownerId: string; ids: string[] }

type SelectionState = {
  selection: Selection
  selectAssets: (ids: string[]) => void
  selectClip: (documentId: string, clipId: string) => void
  selectTrack: (documentId: string, trackId: string) => void
  clear: () => void
}

const NONE: Selection = { kind: 'none' }

/** True when a write would change nothing — see the guard on `selectClip`. */
function sameAsBefore(current: Selection, kind: string, ownerId: string, id: string): boolean {
  return (
    current.kind === kind &&
    'ownerId' in current &&
    current.ownerId === ownerId &&
    current.ids.length === 1 &&
    current.ids[0] === id
  )
}

/**
 * Selection is not focus and not what is open: clicking selects, double-clicking opens. It is
 * global rather than per document because one inspector serves every panel — the asset shelf,
 * the montage and the track headers all point it at what was touched last.
 */
export const useSelection = create<SelectionState>()(set => ({
  selection: NONE,

  selectAssets: ids =>
    set({ selection: ids.length > 0 ? { kind: 'asset', ownerId: null, ids } : NONE }),

  // Guarded: the canvas re-selects the same clip on every pointer down of a drag, and an
  // unguarded write would re-render the inspector on each of them.
  selectClip: (documentId, clipId) =>
    set(state =>
      sameAsBefore(state.selection, 'clip', documentId, clipId)
        ? state
        : { selection: { kind: 'clip', ownerId: documentId, ids: [clipId] } },
    ),

  selectTrack: (documentId, trackId) =>
    set(state =>
      sameAsBefore(state.selection, 'track', documentId, trackId)
        ? state
        : { selection: { kind: 'track', ownerId: documentId, ids: [trackId] } },
    ),

  clear: () => set(state => (state.selection.kind === 'none' ? state : { selection: NONE })),
}))

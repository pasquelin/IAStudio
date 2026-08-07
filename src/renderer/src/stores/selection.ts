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

/**
 * Whether a write would say the same thing as what is already there.
 *
 * Worth asking on every one of them: the canvas re-selects the same clip on every pointer down
 * of a drag, and an unguarded write would re-render the inspector on each of them.
 */
function unchanged(current: Selection, next: Selection): boolean {
  if (current.kind !== next.kind) return false
  if (current.kind === 'none' || next.kind === 'none') return true

  return (
    current.ownerId === next.ownerId &&
    current.ids.length === next.ids.length &&
    current.ids.every((id, at) => id === next.ids[at])
  )
}

/**
 * Selection is not focus and not what is open: clicking selects, double-clicking opens. It is
 * global rather than per document because one inspector serves every panel — the asset shelf,
 * the montage and the track headers all point it at what was touched last.
 */
export const useSelection = create<SelectionState>()(set => {
  const point = (next: Selection): void =>
    set(state => (unchanged(state.selection, next) ? state : { selection: next }))

  return {
    selection: NONE,

    selectAssets: ids => point(ids.length > 0 ? { kind: 'asset', ownerId: null, ids } : NONE),
    selectClip: (documentId, clipId) => point({ kind: 'clip', ownerId: documentId, ids: [clipId] }),
    selectTrack: (documentId, trackId) =>
      point({ kind: 'track', ownerId: documentId, ids: [trackId] }),
    clear: () => point(NONE),
  }
})

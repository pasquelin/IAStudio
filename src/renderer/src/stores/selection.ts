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
  | { kind: 'asset'; ownerId: null; ids: readonly string[] }
  | { kind: 'clip'; ownerId: string; ids: readonly string[] }
  | { kind: 'track'; ownerId: string; ids: readonly string[] }
  | { kind: 'layer'; ownerId: string; ids: readonly string[] }

type SelectionState = {
  selection: Selection
  selectAssets: (ids: readonly string[]) => void
  selectClip: (documentId: string, clipId: string) => void
  selectTrack: (documentId: string, trackId: string) => void
  selectLayer: (documentId: string, layerId: string) => void
  clear: () => void
}

const NONE: Selection = { kind: 'none' }

/** Stable, so a shelf reading it through a selector does not re-render on every other pick. */
const NO_ASSETS: readonly string[] = []

/**
 * The picked assets, or none. Read as a selector rather than off `selection`: a panel that
 * watches the whole descriptor re-renders on every clip, track and layer picked anywhere in
 * the studio, and an asset shelf has no use for any of them.
 */
export function selectedAssetIds(state: Pick<SelectionState, 'selection'>): readonly string[] {
  return state.selection.kind === 'asset' ? state.selection.ids : NO_ASSETS
}

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
    selectLayer: (documentId, layerId) =>
      point({ kind: 'layer', ownerId: documentId, ids: [layerId] }),
    clear: () => point(NONE),
  }
})

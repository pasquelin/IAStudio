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
  /**
   * Rows of the project folder, named by their PATH — which is what a folder walk has and the
   * only thing that is unique in one. Owned by no document, as an asset is: a file belongs to
   * the project, and the gestures over it are the explorer's own scope.
   *
   * Held here rather than in the panel, and that is what the file commands need: ⌘D and ⌘⌫ are
   * heard by the window, and a selection living inside a component would be out of their reach.
   */
  | { kind: 'file'; ownerId: null; ids: readonly string[] }
  | { kind: 'clip'; ownerId: string; ids: readonly string[] }
  | { kind: 'track'; ownerId: string; ids: readonly string[] }
  | { kind: 'layer'; ownerId: string; ids: readonly string[] }
  /**
   * A scene node, and never which one: `SceneState.selectedIds` is where that lives, and it is
   * also written by the commands — a duplicate selects its copies, a delete drops what it
   * removed, ⌘Z puts both back. None of those pass through `selectIn`, so a copy kept here could
   * only go stale. This says the face is the scene's; the face reads the scene for the rest.
   */
  | { kind: 'node'; ownerId: string; ids: readonly string[] }

type SelectionState = {
  selection: Selection
  selectAssets: (ids: readonly string[]) => void
  selectFiles: (paths: readonly string[]) => void
  selectClip: (documentId: string, clipId: string) => void
  selectTrack: (documentId: string, trackId: string) => void
  selectLayer: (documentId: string, layerId: string) => void
  pointAtNodes: (documentId: string, picked: boolean) => void
  clear: () => void
}

const NONE: Selection = { kind: 'none' }

/** Stable, so a surface reading it through a selector does not re-render on every other pick. */
const NO_IDS: readonly string[] = []

/**
 * The picked assets, or none. Read as a selector rather than off `selection`: a panel that
 * watches the whole descriptor re-renders on every clip, track and layer picked anywhere in
 * the studio, and an asset shelf has no use for any of them.
 */
export function selectedAssetIds(state: Pick<SelectionState, 'selection'>): readonly string[] {
  return state.selection.kind === 'asset' ? state.selection.ids : NO_IDS
}

/**
 * The picked rows of the project folder, by path. Read the same way, and for the same reason:
 * the file commands watch this alone, and a picked clip must not wake them.
 */
export function selectedFilePaths(state: Pick<SelectionState, 'selection'>): readonly string[] {
  return state.selection.kind === 'file' ? state.selection.ids : NO_IDS
}

/**
 * Whether the inspector is looking at this very track, in this very document.
 *
 * The owner is compared as well as the id, for the reason this store carries one at all: every
 * sequence names its first tracks `V1` and `A1`, so a track picked in one tab matches by id in
 * the next. A boolean rather than the descriptor: a header row re-renders when ITS answer moves,
 * not when the selection moves anywhere.
 */
export function isTrackSelected(
  state: Pick<SelectionState, 'selection'>,
  documentId: string,
  trackId: string,
): boolean {
  const { selection } = state
  if (selection.kind !== 'track' || selection.ownerId !== documentId) return false
  return selection.ids.includes(trackId)
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
export const useSelection = create<SelectionState>()((set, get) => {
  const point = (next: Selection): void =>
    set(state => (unchanged(state.selection, next) ? state : { selection: next }))

  return {
    selection: NONE,

    selectAssets: ids => point(ids.length > 0 ? { kind: 'asset', ownerId: null, ids } : NONE),
    selectFiles: ids => point(ids.length > 0 ? { kind: 'file', ownerId: null, ids } : NONE),
    selectClip: (documentId, clipId) => point({ kind: 'clip', ownerId: documentId, ids: [clipId] }),
    selectTrack: (documentId, trackId) =>
      point({ kind: 'track', ownerId: documentId, ids: [trackId] }),
    selectLayer: (documentId, layerId) =>
      point({ kind: 'layer', ownerId: documentId, ids: [layerId] }),
    pointAtNodes: (documentId, picked) => {
      if (picked) return point({ kind: 'node', ownerId: documentId, ids: NO_IDS })

      // Emptied only where this scene is what filled it. A click in the void of a viewport used
      // to wipe whatever ANOTHER panel had selected — five assets picked in the shelf, and the
      // two buttons that act on them going grey because a cube was deselected beside them.
      const { selection } = get()
      if (selection.kind === 'node' && selection.ownerId === documentId) point(NONE)
    },
    clear: () => point(NONE),
  }
})

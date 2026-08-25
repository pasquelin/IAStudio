import { create } from 'zustand'

/**
 * What the studio's GLOBAL gestures act on: what kind of thing, which document holds it, and
 * which ones were picked.
 *
 * 🛑 A layer and a scene node are NOT here: they live in their own document and are read from
 * there. The copies kept here were read by nobody, and their one remaining effect was to wipe
 * whatever other kind was held. Nothing goes back in without a reader.
 *
 * The owner is carried rather than looked up — see `isTrackSelected` for what that pays for. An
 * asset belongs to the project rather than to a document, so its owner is null; the shape stays
 * the same all the same, one descriptor to read rather than four to tell apart.
 */
export type Selection =
  | { kind: 'none' }
  | { kind: 'asset'; ownerId: null; ids: readonly string[] }
  /**
   * Rows of the project folder, named by their PATH — which is what a folder walk has and the
   * only thing that is unique in one. Owned by no document, as an asset is: a file belongs to
   * the project, and the gestures over it are the explorer's own scope.
   *
   * Held here so the explorer's commands and its context menu read ONE answer: both go through
   * `selectedFilePaths`, and a second copy would let them disagree.
   */
  | { kind: 'file'; ownerId: null; ids: readonly string[] }
  | { kind: 'clip'; ownerId: string; ids: readonly string[] }
  | { kind: 'track'; ownerId: string; ids: readonly string[] }

type SelectionState = {
  selection: Selection
  selectAssets: (ids: readonly string[]) => void
  selectFiles: (paths: readonly string[]) => void
  selectClip: (documentId: string, clipId: string) => void
  selectTrack: (documentId: string, trackId: string) => void
  clear: () => void
}

const NONE: Selection = { kind: 'none' }

/** Stable, so a surface reading it through a selector does not re-render on every other pick. */
const NO_IDS: readonly string[] = []

/**
 * The picked assets, or none. Read as a selector rather than off `selection`: a panel that
 * watches the whole descriptor re-renders on every clip and track picked anywhere in the studio,
 * and an asset shelf has no use for either.
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
 * Whether this very track, in this very document, is the one picked.
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
 * Selection is not focus and not what is open: clicking selects, double-clicking opens. Global
 * rather than per document because the gestures reading it are — sending to the cloud, the
 * explorer's menu, the folder a new document opens in.
 */
export const useSelection = create<SelectionState>()(set => {
  const point = (next: Selection): void =>
    set(state => (unchanged(state.selection, next) ? state : { selection: next }))

  return {
    selection: NONE,

    selectAssets: ids => point(ids.length > 0 ? { kind: 'asset', ownerId: null, ids } : NONE),
    selectFiles: ids => point(ids.length > 0 ? { kind: 'file', ownerId: null, ids } : NONE),
    selectClip: (documentId, clipId) => point({ kind: 'clip', ownerId: documentId, ids: [clipId] }),
    selectTrack: (documentId, trackId) =>
      point({ kind: 'track', ownerId: documentId, ids: [trackId] }),
    clear: () => point(NONE),
  }
})

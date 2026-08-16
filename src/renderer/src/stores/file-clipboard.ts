import { create } from 'zustand'

/**
 * What Couper and Copier put aside, waiting for a Coller.
 *
 * **Not the system clipboard**, and deliberately: `navigator.clipboard` carries text and images,
 * so paths written into it would either be a list of strings another application would paste as
 * words, or real file promises — a gesture that reaches outside the project, which is the phase
 * after this one. What this holds is a selection of the project folder, and it means something
 * only inside it.
 *
 * One per window rather than one per project: it lives as long as the window does, and a paste
 * into another project is a paste of paths relative to a folder that is no longer open. The
 * project change is what clears it.
 */
export type FileClipboard = {
  /** Paths of the project folder, in the order they were picked. Empty when nothing is held. */
  paths: readonly string[]
  /** Whether the next paste MOVES them. Cut and copy differ by this and by nothing else. */
  cut: boolean
  hold: (paths: readonly string[], cut: boolean) => void
  clear: () => void
}

const NOTHING: readonly string[] = []

/**
 * The paths waiting to be MOVED, which is what a panel draws dimmed — empty for a copy, which
 * takes nothing away and so shows nothing.
 *
 * A selector rather than a read of the whole store, and stable when there is nothing: a panel
 * watching the object would re-render on a copy it draws no differently.
 */
export function fileClipboardCut(state: FileClipboard): readonly string[] {
  return state.cut ? state.paths : NOTHING
}

export const useFileClipboard = create<FileClipboard>()(set => ({
  paths: NOTHING,
  cut: false,
  hold: (paths, cut) => set({ paths, cut }),
  // Kept as `cut: false` rather than left as it was: an empty clipboard that still reads as a
  // cut would dim nothing and mean nothing, and the flag is only ever read beside the paths.
  clear: () => set({ paths: NOTHING, cut: false }),
}))

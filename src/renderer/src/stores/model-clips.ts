import { create } from 'zustand'

type ClipsByNode = Record<string, readonly string[]>

type ModelClipsState = {
  /** Keyed by document, then by node: two tabs may hold the same model at different heads. */
  clips: Record<string, ClipsByNode>
  report: (documentId: string, nodeId: string, clips: readonly string[]) => void
  forget: (documentId: string) => void
}

/**
 * What clips each imported model brought, as its file reported them.
 *
 * Engine state rather than document state, and that is why it is not in `useScenes`: the names
 * live inside the GLB, so they are only known once the file has landed and are gone the moment
 * the viewport is thrown away. A document holds the name of the clip it plays — never the list
 * of the ones it could.
 */
export const useModelClips = create<ModelClipsState>()(set => ({
  clips: {},
  report: (documentId, nodeId, clips) =>
    set(state => ({
      clips: {
        ...state.clips,
        [documentId]: { ...state.clips[documentId], [nodeId]: clips },
      },
    })),
  forget: documentId =>
    set(state => {
      const { [documentId]: gone, ...rest } = state.clips
      void gone
      return { clips: rest }
    }),
}))

/**
 * Answered for a node nothing has reported for. Shared rather than built on the spot: this is
 * read through a zustand selector, and a fresh array per call is a new snapshot every render —
 * the loop then never settles, which is the very trap `SceneInspector` carries a note about.
 */
const NO_CLIPS: readonly string[] = []

/** The clips a node can be asked to play, or none — a model still loading has none yet. */
export function clipsOfNode(
  state: ModelClipsState,
  documentId: string,
  nodeId: string,
): readonly string[] {
  return state.clips[documentId]?.[nodeId] ?? NO_CLIPS
}

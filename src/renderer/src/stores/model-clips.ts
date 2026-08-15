import { create } from 'zustand'

type ClipsByNode = Record<string, readonly string[]>

/** How long each clip runs, in the seconds three measures it in, keyed by name. */
type LengthsByNode = Record<string, Readonly<Record<string, number>>>

type ModelClipsState = {
  /** Keyed by document, then by node: two tabs may hold the same model at different heads. */
  clips: Record<string, ClipsByNode>
  /** The bones of each rigged model, the same way and for the same reason. */
  bones: Record<string, ClipsByNode>
  /**
   * How long each clip runs. Same reason as the names: the length lives in the GLB, so nothing
   * that reads only the document can draw a block of the right width.
   */
  lengths: Record<string, LengthsByNode>
  report: (
    documentId: string,
    nodeId: string,
    clips: readonly string[],
    lengths?: Readonly<Record<string, number>>,
  ) => void
  reportBones: (documentId: string, nodeId: string, bones: readonly string[]) => void
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
  bones: {},
  lengths: {},
  report: (documentId, nodeId, clips, lengths) =>
    set(state => ({
      clips: {
        ...state.clips,
        [documentId]: { ...state.clips[documentId], [nodeId]: clips },
      },
      lengths: {
        ...state.lengths,
        [documentId]: { ...state.lengths[documentId], [nodeId]: lengths ?? {} },
      },
    })),
  reportBones: (documentId, nodeId, bones) =>
    set(state => ({
      bones: {
        ...state.bones,
        [documentId]: { ...state.bones[documentId], [nodeId]: bones },
      },
    })),

  forget: documentId =>
    set(state => {
      const { [documentId]: goneClips, ...clips } = state.clips
      const { [documentId]: goneBones, ...bones } = state.bones
      const { [documentId]: goneLengths, ...lengths } = state.lengths
      void goneClips
      void goneBones
      void goneLengths
      return { clips, bones, lengths }
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

/** How long one clip of a node runs, in seconds, or nothing while its file has not landed. */
export function clipLengthOf(
  state: ModelClipsState,
  documentId: string,
  nodeId: string,
  clip: string,
): number | null {
  return state.lengths[documentId]?.[nodeId]?.[clip] ?? null
}

/** The bones a node's model brought, or none — a mesh has none, and neither has a loading model. */
export function bonesOfNode(
  state: ModelClipsState,
  documentId: string,
  nodeId: string,
): readonly string[] {
  return state.bones[documentId]?.[nodeId] ?? NO_CLIPS
}

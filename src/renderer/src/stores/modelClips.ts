import { create } from 'zustand'
import type { RigState } from '@/engines/scene/rigState'

type ClipsByNode = Record<string, readonly string[]>

/** How long each clip runs, in the seconds three measures it in, keyed by name. */
type LengthsByNode = Record<string, Readonly<Record<string, number>>>

type ModelClipsState = {
  /** Keyed by document, then by node: two tabs may hold the same model at different heads. */
  clips: Record<string, ClipsByNode>
  /** What each model IS, as the file that landed says — bones, roles and all. */
  rigs: Record<string, Record<string, RigState>>
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
  reportRig: (documentId: string, nodeId: string, rig: RigState) => void
  /**
   * How far along binding a model's skeleton is, 0 to 1. Absent means "not binding" — which a
   * number cannot say, and a model at 0 has to read differently from one nobody asked about.
   */
  rigProgress: Record<string, Record<string, number>>
  reportRigProgress: (documentId: string, nodeId: string, progress: number) => void
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
  rigs: {},
  rigProgress: {},
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
  reportRig: (documentId, nodeId, rig) =>
    set(state => ({
      rigs: {
        ...state.rigs,
        [documentId]: { ...state.rigs[documentId], [nodeId]: rig },
      },
    })),

  reportRigProgress: (documentId, nodeId, progress) =>
    set(state => {
      const forDocument = { ...state.rigProgress[documentId] }
      // Taken out at the end rather than left at 1: what says "binding" is the field being there.
      if (progress >= 1) delete forDocument[nodeId]
      else forDocument[nodeId] = progress

      return { rigProgress: { ...state.rigProgress, [documentId]: forDocument } }
    }),

  forget: documentId =>
    set(state => {
      const { [documentId]: goneClips, ...clips } = state.clips
      const { [documentId]: goneRigs, ...rigs } = state.rigs
      const { [documentId]: goneProgress, ...rigProgress } = state.rigProgress
      const { [documentId]: goneLengths, ...lengths } = state.lengths
      void goneClips
      void goneRigs
      void goneProgress
      void goneLengths
      return { clips, rigs, rigProgress, lengths }
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

/** How far along a node's bind is, or `null` when nothing is being bound for it. */
export function rigProgressOfNode(
  state: ModelClipsState,
  documentId: string,
  nodeId: string,
): number | null {
  return state.rigProgress[documentId]?.[nodeId] ?? null
}

/** What a node's model is, or nothing at all while its file has not landed. */
export function rigOfNode(
  state: ModelClipsState,
  documentId: string,
  nodeId: string,
): RigState | null {
  return state.rigs[documentId]?.[nodeId] ?? null
}

/** The bones a node's model brought, or none — a mesh has none, and neither has a loading model. */
export function bonesOfNode(
  state: ModelClipsState,
  documentId: string,
  nodeId: string,
): readonly string[] {
  return state.rigs[documentId]?.[nodeId]?.boneNames ?? NO_CLIPS
}

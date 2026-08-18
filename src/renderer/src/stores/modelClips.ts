import { create } from 'zustand'
import type { RetargetFit } from '@/engines/scene/retarget'
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
  /**
   * How well each foreign clip fits the character playing it, by `clipKeyOf`.
   *
   * Engine state like everything else here: only the engine ever holds both skeletons at once,
   * and nothing in the document says which joints the two have in common.
   */
  fits: Record<string, Record<string, Record<string, RetargetFit>>>
  reportClipFit: (documentId: string, nodeId: string, clipKey: string, fit: RetargetFit) => void
  forget: (documentId: string) => void
}

/**
 * What clips each imported model brought, as its file reported them.
 *
 * Engine state and not document state: the names live inside the GLB, so a document holds the
 * name of the clip it plays — never the list of the ones it could.
 */
export const useModelClips = create<ModelClipsState>()(set => ({
  clips: {},
  rigs: {},
  rigProgress: {},
  lengths: {},
  fits: {},
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

  reportClipFit: (documentId, nodeId, clipKey, fit) =>
    set(state => {
      const forDocument = state.fits[documentId] ?? {}
      return {
        fits: {
          ...state.fits,
          [documentId]: {
            ...forDocument,
            [nodeId]: { ...forDocument[nodeId], [clipKey]: fit },
          },
        },
      }
    }),

  forget: documentId =>
    set(state => {
      const { [documentId]: goneClips, ...clips } = state.clips
      const { [documentId]: goneRigs, ...rigs } = state.rigs
      const { [documentId]: goneProgress, ...rigProgress } = state.rigProgress
      const { [documentId]: goneLengths, ...lengths } = state.lengths
      const { [documentId]: goneFits, ...fits } = state.fits
      void goneClips
      void goneRigs
      void goneProgress
      void goneLengths
      void goneFits
      return { clips, rigs, rigProgress, lengths, fits }
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

/**
 * How well one foreign clip fits this character, or nothing while the engine has not read it.
 *
 * `null` also answers a clip the model's own file brought: nothing is retargeted then, so there
 * is no fit to speak of — and « perfectly » would be a claim rather than a measurement.
 */
export function clipFitOfNode(
  state: ModelClipsState,
  documentId: string,
  nodeId: string,
  clipKey: string,
): RetargetFit | null {
  return state.fits[documentId]?.[nodeId]?.[clipKey] ?? null
}

/** The bones a node's model brought, or none — a mesh has none, and neither has a loading model. */
export function bonesOfNode(
  state: ModelClipsState,
  documentId: string,
  nodeId: string,
): readonly string[] {
  return state.rigs[documentId]?.[nodeId]?.boneNames ?? NO_CLIPS
}

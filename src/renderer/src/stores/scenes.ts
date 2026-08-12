import type { AnimationTrack } from '@shared/domain/animation'
import type { Asset } from '@shared/domain/asset'
import { updateAnimationTrack } from '@/engines/scene/animation-commands'
import { addNode, setSelection } from '@/engines/scene/commands'
import { modelNode } from '@/engines/scene/node-factory'
import { EMPTY_SCENE, type SceneState } from '@/engines/scene/scene-state'
import type { SelectionMode } from '@/helpers/selection'
import { createDocumentStore } from './document-store'

/** One scene per document, in memory like the documents themselves. */
const store = createDocumentStore<SceneState>(EMPTY_SCENE)

export const sceneStore = store
export const useScenes = store.use
export const sceneOf = store.stateOf
export const sceneHistoryOf = store.historyOf
export const isDirty = store.isDirty

/**
 * Selection stays out of the history, so it writes the whole scene back — and the scene has to
 * be read at call time, not from the render that drew the row: a copy taken before whatever
 * command ran in between would undo it.
 */
/**
 * A flag of an animation track, written without an entry in the history — how one works, not what
 * one made. The pendant of `sequences.writeTrack`, and for the same reason.
 */
export function writeAnimationTrack(
  documentId: string,
  trackId: string,
  change: (track: AnimationTrack) => AnimationTrack,
): void {
  const current = store.use.getState()
  current.replace(
    documentId,
    updateAnimationTrack(store.stateOf(current, documentId), trackId, change),
  )
}

export function selectIn(
  documentId: string,
  ids: readonly string[],
  mode: SelectionMode = 'replace',
): void {
  const state = useScenes.getState()
  state.replace(documentId, setSelection(sceneOf(state, documentId), ids, mode))
}

/**
 * The one way an imported model enters a scene, whichever door it came through: a double-click
 * in the asset browser, a drop on the viewport, or a 3D generation landing in the tab it was
 * launched from. Three call sites building the node their own way is three ways for a model to
 * arrive without a name.
 *
 * Answers whether it went in, so a caller that owns a gesture — a drop — knows whether to
 * swallow it. An asset of another type is refused rather than turned into an empty node.
 */
export function addModelTo(documentId: string, asset: Asset): boolean {
  if (asset.type !== 'mesh') return false

  useScenes.getState().runCommand(documentId, addNode(modelNode(asset.id, asset.name)))
  return true
}

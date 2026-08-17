import type { AnimationTrack } from '@shared/domain/animation'
import type { Asset } from '@shared/domain/asset'
import { updateAnimationTrack } from '@/engines/scene/animationCommands'
import { addNode, setSelection } from '@/engines/scene/commands'
import { modelNode } from '@/engines/scene/nodeFactory'
import { EMPTY_SCENE, type SceneState } from '@/engines/scene/sceneState'
import type { SelectionMode } from '@/helpers/selection'
import { createDocumentStore } from './documentStore'
import { useSelection } from './selection'

/** One scene per document, in memory like the documents themselves. */
const store = createDocumentStore<SceneState>(EMPTY_SCENE)

export const sceneStore = store
export const useScenes = store.use
export const sceneOf = store.stateOf
export const sceneHistoryOf = store.historyOf
export const isSceneDirty = store.isDirty

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

/**
 * What is picked in a scene, wherever the gesture came from — the outliner, the two node panels
 * or the viewport.
 *
 * Selection stays out of the history, so it writes the whole scene back — and the scene has to
 * be read at call time, not from the render that drew the row: a copy taken before whatever
 * command ran in between would undo it.
 *
 * It points the studio's selection at the scene too, and keeps doing so even though
 * `connectSceneSelection` watches every write of the document in front: a click on the row that
 * is ALREADY selected changes no ids, so it writes no state and wakes no subscriber — and it is
 * exactly the gesture someone makes to bring the panel back onto a node after clicking an asset
 * in the browser. It points at whichever document it is given, where the connector answers only
 * for the one in front; the three callers all render the front tab, so the two never disagree.
 *
 * The scene holds what the viewport highlights, `useSelection` holds which FACE the inspector
 * shows. `canvases` does the same pairing at its call site rather than here; four callers against
 * one is the whole of the difference.
 *
 * Which nodes is deliberately NOT copied over — `pointAtNodes` says why.
 */
export function selectIn(
  documentId: string,
  ids: readonly string[],
  mode: SelectionMode = 'replace',
): void {
  const state = useScenes.getState()
  const current = sceneOf(state, documentId)
  const next = setSelection(current, ids, mode)

  // Guarded on the ids rather than on the state, which `setSelection` copies either way: clicking
  // a row that is already selected — the gesture that OPENS a drag — otherwise wrote the document
  // back, and the viewport rebuilt its whole scene graph on the strength of it.
  if (next.selectedIds !== current.selectedIds) state.replace(documentId, next)
  useSelection.getState().pointAtNodes(documentId, next.selectedIds.length > 0)
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

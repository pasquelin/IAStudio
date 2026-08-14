import type { AnimationTrack } from '@shared/domain/animation'
import type { Asset } from '@shared/domain/asset'
import { updateAnimationTrack } from '@/engines/scene/animation-commands'
import { addNode, setSelection } from '@/engines/scene/commands'
import { modelNode } from '@/engines/scene/node-factory'
import { EMPTY_SCENE, type SceneState } from '@/engines/scene/scene-state'
import type { SelectionMode } from '@/helpers/selection'
import { createDocumentStore } from './document-store'
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
 * It writes the studio's selection too, and that is the point of going through one function: the
 * scene holds what the viewport highlights, `useSelection` holds what the INSPECTOR reads, and
 * for as long as the 3D space wrote only the first one, picking a node left the inspector on
 * whatever asset had been clicked in the browser — which is how a model got imported in the
 * first place. What lands there is the resolved selection rather than the ids asked for: a
 * toggle removes as often as it adds.
 */
export function selectIn(
  documentId: string,
  ids: readonly string[],
  mode: SelectionMode = 'replace',
): void {
  const state = useScenes.getState()
  const next = setSelection(sceneOf(state, documentId), ids, mode)
  state.replace(documentId, next)
  useSelection.getState().selectNodes(documentId, next.selectedIds)
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

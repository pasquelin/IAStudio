import type { CameraShot } from '@shared/domain/animation'
import { railsInUse } from '@/engines/scene/cameraShots'
import { sceneViewOf, useSceneViews } from './sceneViews'
import { useScenes } from './scenes'

/**
 * Lets go of what a scene had picked INSIDE something it no longer has selected — a bone, a rail's
 * control point. Subscribed rather than called per site: `removeNodes`, `addNodes` and ⌘Z rewrite
 * `selectedIds` without passing through `selectIn`, and a pick left behind arms the wrong gesture.
 */
export function connectSubSelectionRelease(): () => void {
  return useScenes.subscribe((state, previous) => {
    // `for...in` and not `Object.entries`, which allocates a tuple per document on a path a
    // pointer gesture writes to at 60 Hz.
    for (const documentId in state.states) {
      const scene = state.states[documentId]
      if (!scene || scene.selectedIds === previous.states[documentId]?.selectedIds) continue
      releaseSubSelection(documentId, scene.selectedIds, scene.animation.shots)
    }
  })
}

/**
 * A bone belongs to the model it is in; a control point belongs to a rail being worked on, which
 * is what `railsInUse` answers — a rail a selected CAMERA rides counts, or grabbing a knob of one
 * would let go of it on the spot.
 */
function releaseSubSelection(
  documentId: string,
  selectedIds: readonly string[],
  shots: readonly CameraShot[],
): void {
  const views = useSceneViews.getState()
  const view = sceneViewOf(views, documentId)

  if (view.pickedBone && !selectedIds.includes(view.pickedBone.nodeId)) {
    views.setPickedBone(documentId, null)
  }
  if (view.pickedPathPoint && !railsInUse(selectedIds, shots).has(view.pickedPathPoint.nodeId)) {
    views.setPickedPathPoint(documentId, null)
  }
}

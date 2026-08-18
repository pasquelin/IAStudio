import { snapToFrame, type Us } from '@shared/domain/time'
import type { SceneState } from '@/engines/scene/sceneState'
import { animationViewOf, useAnimationViews } from '@/stores/animationView'
import { sceneOf, useScenes } from '@/stores/scenes'
import { sceneViewOf, useSceneViews } from '@/stores/sceneViews'

export type SceneKeying = {
  state: SceneState
  /** Where a key lands: the head SNAPPED, since the head itself runs on the wall clock. */
  at: Us
  /** Whether auto-key is on — see `recordsKeys`, which decides what that means. */
  recording: boolean
}

/**
 * What any gesture that may write a key needs to know, read at call time rather than subscribed
 * to: the document, the instant, and the switch.
 *
 * Three stores in one place because the three answers have to agree — a gesture reading the head
 * raw here and snapped there writes a key where nothing reads it back.
 */
export function sceneKeyingAt(documentId: string): SceneKeying {
  const state = sceneOf(useScenes.getState(), documentId)
  const { playhead } = sceneViewOf(useSceneViews.getState(), documentId)

  return {
    state,
    at: snapToFrame(playhead, state.animation.fps),
    recording: animationViewOf(useAnimationViews.getState(), documentId).autoKey,
  }
}

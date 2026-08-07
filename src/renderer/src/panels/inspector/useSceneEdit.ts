import { useMemo } from 'react'
import type { Command } from '@/engines/core/history'
import type { SceneState } from '@/engines/scene/scene-state'
import { useScenes } from '@/stores/scenes'

/** The two ends of a gesture, as the design system's controls report them. */
export type Gesture = {
  onGestureStart: () => void
  onGestureEnd: () => void
}

export type SceneEdit = Gesture & {
  run: (command: Command<SceneState>) => void
}

/**
 * Editing one document: a command to run, and the gesture that groups a drag into one history
 * entry. Read from the store at call time rather than subscribed to — the inspector re-renders
 * on every value a drag emits, and a bound action would be a new object on each of them.
 */
export function useSceneEdit(documentId: string): SceneEdit {
  return useMemo(
    () => ({
      run: command => useScenes.getState().runCommand(documentId, command),
      onGestureStart: () => useScenes.getState().beginGesture(documentId),
      onGestureEnd: () => useScenes.getState().endGesture(documentId),
    }),
    [documentId],
  )
}

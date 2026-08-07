import { useMemo } from 'react'
import type { GestureProps } from '@/design/styles'
import type { Command } from '@/engines/core/history'
import type { SceneState } from '@/engines/scene/scene-state'
import { useScenes } from '@/stores/scenes'

export type SceneEdit = {
  run: (command: Command<SceneState>) => void
  /** Spread onto a field, which reports both ends of what the user did in one go. */
  gesture: Required<GestureProps>
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
      gesture: {
        onGestureStart: () => useScenes.getState().beginGesture(documentId),
        onGestureEnd: () => useScenes.getState().endGesture(documentId),
      },
    }),
    [documentId],
  )
}

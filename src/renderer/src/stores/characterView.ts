import { create } from 'zustand'
import type { TransformMode } from '@/engines/scene/gizmoTarget'

/**
 * Which bone is picked in the skeleton window. Outside the character for the reason a scene's
 * view is outside its document: picking is not an edit, and has no business on the undo stack.
 */
type CharacterViewState = {
  /** A bone has no id — it is addressed by name, like every track that drives one. */
  pickedBone: string | null
  pickBone: (bone: string | null) => void
  /**
   * What the gizmo does to the joint that is picked. Opens on `translate`: a skeleton read off a
   * bounding box lands each joint near enough, and placing them is the first thing a hand does.
   */
  mode: TransformMode
  setCharacterMode: (mode: TransformMode) => void
}

export const useCharacterView = create<CharacterViewState>()(set => ({
  pickedBone: null,
  pickBone: pickedBone => set(state => (state.pickedBone === pickedBone ? state : { pickedBone })),
  mode: 'translate',
  setCharacterMode: mode => set({ mode }),
}))

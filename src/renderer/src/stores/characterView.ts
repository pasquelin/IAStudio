import { create } from 'zustand'

/**
 * How the skeleton window is being LOOKED at: which bone is picked, whether one is posing.
 *
 * Outside the character for the same reason a scene's view is outside its document: picking a
 * bone is not an edit, and it has no business on the undo stack. One window, one character, so
 * nothing here is keyed.
 */
type CharacterViewState = {
  /** The bone a click picked, or nothing. A bone has no id — it is addressed by name. */
  pickedBone: string | null
  pickBone: (bone: string | null) => void
  /** Turning bones rather than moving them, which are the two gestures nobody may confuse. */
  poseMode: boolean
  setPoseMode: (poseMode: boolean) => void
}

export const useCharacterView = create<CharacterViewState>()(set => ({
  pickedBone: null,
  pickBone: pickedBone => set(state => (state.pickedBone === pickedBone ? state : { pickedBone })),
  poseMode: false,
  setPoseMode: poseMode => set({ poseMode }),
}))

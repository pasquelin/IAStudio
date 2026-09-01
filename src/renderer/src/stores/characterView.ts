import { create } from 'zustand'

/**
 * Which bone is picked in the skeleton window. Outside the character for the reason a scene's
 * view is outside its document: picking is not an edit, and has no business on the undo stack.
 */
type CharacterViewState = {
  /** A bone has no id — it is addressed by name, like every track that drives one. */
  pickedBone: string | null
  pickBone: (bone: string | null) => void
}

export const useCharacterView = create<CharacterViewState>()(set => ({
  pickedBone: null,
  pickBone: pickedBone => set(state => (state.pickedBone === pickedBone ? state : { pickedBone })),
}))

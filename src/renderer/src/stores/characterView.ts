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
  /**
   * The axes a joint is held still on, while one is being placed. Session state like the pick:
   * a hold is how a hand moves a knee straight down without letting it drift forward, and it is
   * not a property of the skeleton.
   */
  heldAxes: readonly BoneAxis[]
  holdCharacterAxis: (axis: BoneAxis, held: boolean) => void
}

/** The three a joint can be held on. Named here because two surfaces and a command read it. */
export type BoneAxis = 'x' | 'y' | 'z'

export const useCharacterView = create<CharacterViewState>()(set => ({
  pickedBone: null,
  pickBone: pickedBone => set(state => (state.pickedBone === pickedBone ? state : { pickedBone })),
  mode: 'translate',
  setCharacterMode: mode => set({ mode }),
  heldAxes: [],
  holdCharacterAxis: (axis, held) =>
    set(state => ({
      heldAxes: held
        ? [...new Set([...state.heldAxes, axis])]
        : state.heldAxes.filter(one => one !== axis),
    })),
}))

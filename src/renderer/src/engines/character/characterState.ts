import { EMPTY_TIMELINE, type AnimationTimeline } from '@shared/domain/animation'
import type { CharacterSocket, MotionRef } from '@shared/domain/character'
import type { Rig } from '@shared/domain/rig'

/**
 * A character as the skeleton window holds it: its own file, and nothing of any scene.
 *
 * Flat, and that is the point — the window edits ONE character, so a state keyed by node id
 * would carry a parameter that always holds the same value.
 */
export type CharacterState = {
  /** The catalogue row whose `.glb` this is. Empty until the window has been told. */
  assetId: string
  rig: Rig | null
  sockets: readonly CharacterSocket[]
  motions: readonly MotionRef[]
  /** The motion being edited, which is the only one the band shows. */
  editing: string | null
  /** That motion's own keys. Never a scene's: this band is not a montage. */
  animation: AnimationTimeline
}

export const EMPTY_CHARACTER: CharacterState = {
  assetId: '',
  rig: null,
  sockets: [],
  motions: [],
  editing: null,
  animation: EMPTY_TIMELINE,
}

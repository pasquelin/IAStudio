import { create } from 'zustand'
import type { AiRoleId } from '@shared/domain/aiRole'

/**
 * What the person asked of the generation panel, as opposed to what the workspace suggests.
 *
 * Session state, deliberately unpersisted: an operation forced yesterday, against a selection
 * that is long gone, is not a preference — it is a gesture that has ended. What IS a preference
 * lives in `RoleChoices`, and `useModels.selected` holds the model each employment is on.
 */
type GenerationState = {
  /**
   * The employment the person picked by hand, or `null` to follow the context.
   *
   * § 21: it wins while the context can still reach it, and gives way rather than leaving the
   * panel offering a Generate that would die.
   */
  forcedCapability: AiRoleId | null
  forceCapability: (role: AiRoleId | null) => void
}

export const useGeneration = create<GenerationState>()(set => ({
  forcedCapability: null,
  forceCapability: role => set({ forcedCapability: role }),
}))

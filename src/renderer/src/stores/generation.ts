import { create } from 'zustand'
import type { AiRoleId } from '@shared/domain/aiRole'

/**
 * What the person asked of the generation panel, against what the workspace suggests.
 *
 * Session state, deliberately unpersisted: an operation forced against a selection that is long
 * gone is a gesture that has ended, not a preference. Preferences live in `RoleChoices`.
 */
type GenerationState = {
  /**
   * The employment picked by hand, or `null` to follow the context. It wins while the context can
   * still reach it, and gives way rather than leaving a Generate that would die.
   */
  forcedCapability: AiRoleId | null
  forceCapability: (role: AiRoleId | null) => void
}

export const useGeneration = create<GenerationState>()(set => ({
  forcedCapability: null,
  forceCapability: role => set({ forcedCapability: role }),
}))

import { useGeneration } from './generation'
import { useLayouts } from './layouts'

/**
 * Closes a preparation when the user leaves the space that made it.
 *
 * Ignoring it elsewhere would be enough for the other generators to show the right operation, but
 * coming back would silently reopen the edit's — an upscale armed in a space nobody is in.
 */
export function connectPreparation(): () => void {
  return useLayouts.subscribe((state, previous) => {
    if (state.activeWorkspace !== previous.activeWorkspace) {
      useGeneration.getState().forceCapability(null)
    }
  })
}

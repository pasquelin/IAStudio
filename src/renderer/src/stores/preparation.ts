import { useGeneration } from './generation'
import { useLayouts } from './layouts'
import { useModels } from './models'

/**
 * Closes a preparation when the user leaves the space that made it.
 *
 * Ignoring it elsewhere would be enough for the other generators to show the right model, but
 * coming back would silently reopen the edit's model while the Models panel still shows the
 * space's own — two panels disagreeing about what Generate would run.
 */
export function connectPreparation(): () => void {
  return useLayouts.subscribe((state, previous) => {
    if (state.activeWorkspace === previous.activeWorkspace) return

    useModels.getState().dropPreparation()
    // Both halves of one gesture: the edit armed an operation as well as a model, and leaving
    // the space with the operation still forced reopens it later with nothing to explain it.
    useGeneration.getState().forceCapability(null)
  })
}

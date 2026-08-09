import { preferredModelOf, type ModelScope } from '@shared/domain/model'
import { useModels } from '@/stores/models'
import { useSettings } from '@/stores/settings'

/**
 * Written once because three callers must agree on it, and did not: the rail decides whether to
 * draw the generator at all from this answer, and a graph's generator node read the session
 * choice alone — so it failed in a space where the rail already said a model was there.
 */
export function modelForScope(scope: ModelScope): string | undefined {
  const { defaultModels } = useSettings.getState().settings.generation
  return useModels.getState().selected[scope] ?? preferredModelOf(scope, defaultModels)
}

/**
 * The same answer, subscribed — for the two surfaces that must redraw the moment a model is
 * picked: the generator, and the rail that decides whether to draw it at all.
 *
 * Two selectors rather than one over both stores: zustand compares what a selector returns, and
 * a single one spanning two stores cannot be subscribed to either.
 */
export function useModelForScope(scope: ModelScope | null): string | null {
  const chosen = useModels(state => (scope ? state.selected[scope] : undefined))
  const preferred = useSettings(state =>
    scope ? preferredModelOf(scope, state.settings.generation.defaultModels) : undefined,
  )
  return chosen ?? preferred ?? null
}

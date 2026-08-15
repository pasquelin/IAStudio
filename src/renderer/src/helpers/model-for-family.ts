import type { ModelFamily } from '@shared/domain/model'
import { useModels } from '@/stores/models'
import { useSettings } from '@/stores/settings'

/**
 * Written once because three callers must agree on it, and did not: the rail decides whether to
 * draw the generator at all from this answer, and a caller reading the session choice alone
 * failed in a space where the rail already said a model was there.
 */
export function modelForFamily(family: ModelFamily): string | undefined {
  const { defaultModels } = useSettings.getState().settings.generation
  return useModels.getState().selected[family] ?? defaultModels[family]
}

/**
 * The same answer, subscribed — for the two surfaces that must redraw the moment a model is
 * picked: the generator, and the rail that decides whether to draw it at all.
 *
 * `null` is the home, which browses no catalogue and therefore has no preference to read.
 *
 * Two selectors rather than one over both stores: zustand compares what a selector returns, and
 * a single one spanning two stores cannot be subscribed to either.
 */
export function useModelForFamily(family: ModelFamily | null): string | null {
  const chosen = useModels(state => (family ? state.selected[family] : undefined))
  const preferred = useSettings(state =>
    family ? state.settings.generation.defaultModels[family] : undefined,
  )
  return chosen ?? preferred ?? null
}

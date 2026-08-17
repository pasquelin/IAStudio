import type { ModelFamily } from '@shared/domain/model'
import { useModels } from '@/stores/models'
import { useSettings } from '@/stores/settings'

/**
 * The model a family answers with, subscribed — for the two surfaces that must redraw the moment
 * a model is picked: the generator, and the rail that decides whether to draw it at all.
 * `modelForFamily` is the same answer read once, for everything outside React.
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

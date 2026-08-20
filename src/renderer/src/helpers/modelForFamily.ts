import type { ModelFamily } from '@shared/domain/model'
import { useModels } from '@/stores/models'
import { useSettings } from '@/stores/settings'

/**
 * Written once because three callers must agree on it, and did not: the rail decides whether to
 * draw the generator at all from this answer, and a caller reading the session choice alone
 * failed in a space where the rail already said a model was there. `useModelForFamily` is the
 * same answer subscribed, for the surfaces that must redraw when it moves.
 */
export function modelForFamily(family: ModelFamily): string | undefined {
  const { defaultModels } = useSettings.getState().settings.generation
  return useModels.getState().selected[family] ?? defaultModels[family]
}

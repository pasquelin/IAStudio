import type { AiRoleId } from '@shared/domain/aiRole'
import { resolveModelForCapability } from '@/helpers/modelForCapability'
import { useAiModels } from '@/stores/aiModels'
import { useModels } from '@/stores/models'

/**
 * The model an employment generates with, subscribed — for the surfaces that must redraw the
 * moment one is picked. `modelForCapability` is the same answer read once, outside React.
 *
 * `null` for no employment at all, which is what the home asks: it browses no catalogue.
 */
export function useModelForCapability(role: AiRoleId | null): string | null {
  const chosen = useModels(state => (role ? state.selected[role] : undefined))

  // 🛑 The ANSWER, never `state.overview` itself: the manager republishes the whole overview per
  // percent of a load and per tick of an install, and a subscription to the object re-rendered the
  // generator and every rail with it. A string compares by value, so an identical republish stops
  // here.
  return useAiModels(state =>
    role ? (resolveModelForCapability(role, chosen, state.overview) ?? null) : null,
  )
}

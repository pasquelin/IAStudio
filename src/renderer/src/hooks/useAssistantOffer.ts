import { servedBy } from '@shared/domain/aiOverview'
import { ASSISTANT_ROLE } from '@shared/domain/aiRole'
import { useAiModels } from '@/stores/aiModels'

/** `unknown` until the manager answers at all — not the same as nothing serving the assistant. */
export type AssistantOffer = 'unknown' | 'unserved' | 'served'

/**
 * Whether anything answers when one talks to the studio. A string, never `state.overview` — the
 * manager republishes it per percent of a download, and the same reference-versus-value trap is
 * written out in `useModelForCapability`.
 */
export function useAssistantOffer(): AssistantOffer {
  return useAiModels(state => {
    if (state.overview === null) return 'unknown'

    return state.overview.roles.some(row => row.role === ASSISTANT_ROLE && servedBy(row))
      ? 'served'
      : 'unserved'
  })
}

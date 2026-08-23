import { useQuery } from '@tanstack/react-query'
import { partsOfRole, type AiRoleId } from '@shared/domain/aiRole'
import type { ModelSummary } from '@shared/domain/model'
import { getBridge } from '@/services/bridge'

/**
 * A picker is not a browser: past a hundred entries it stops being usable long before it stops
 * being complete. The order is the API's own relevance, so the most used models come first.
 */
const PICKER_LIMIT = 100

const NONE: readonly ModelSummary[] = []

/**
 * Every model that serves this employment, local and cloud. One request: the registry already
 * files a manifest under the same `ModelSummary` a catalogue row is, and narrows both by the
 * capability — the studio's own included, which no model publishes.
 */
export function useModelsForCapability(role: AiRoleId | null): readonly ModelSummary[] {
  const parts = role === null ? null : partsOfRole(role)

  const { data } = useQuery<readonly ModelSummary[]>({
    queryKey: ['models', 'capability', role],
    queryFn: async () => {
      // `enabled` below is what makes this non-null; the key already carries the role.
      const page = await getBridge()?.provider.searchModels({
        family: parts?.family,
        capabilities: parts ? [parts.capability] : undefined,
        limit: PICKER_LIMIT,
      })

      return page?.items ?? NONE
    },
    enabled: parts !== null,
  })

  return data ?? NONE
}

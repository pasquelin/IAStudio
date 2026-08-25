import { useQuery } from '@tanstack/react-query'
import { partsOfRole, type AiRoleId } from '@shared/domain/aiRole'
import { LOCAL_RUNTIME, type ModelSummary } from '@shared/domain/model'
import { getBridge } from '@/services/bridge'
import { useModelPages } from './useModelPages'

/** Named rather than left to the registry's own default, which is 24 and would truncate in silence. */
const EVERY_LOCAL = 100

const NONE: readonly ModelSummary[] = []

/**
 * Every model that serves this employment, local and cloud. The registry files a manifest under
 * the same `ModelSummary` a catalogue row is, and narrows both by the capability — the studio's
 * own included, which no model publishes.
 *
 * Two reads: the machine's own models are held in memory, and used to ride in the same promise
 * as the catalogue walk.
 */
export function useModelsForCapability(role: AiRoleId | null): readonly ModelSummary[] {
  const parts = role === null ? null : partsOfRole(role)
  // `enabled` below is what makes this non-null; the key already carries the role.
  const narrowed = parts ? { family: parts.family, capabilities: [parts.capability] } : {}

  // `runsOn: LOCAL_RUNTIME` closes the walk in the registry before its first request, so this
  // answers off the manifests alone — no cursor, no network.
  const { data: onThisMachine } = useQuery<readonly ModelSummary[]>({
    queryKey: ['models', 'capability', role, LOCAL_RUNTIME],
    queryFn: async () =>
      (
        await getBridge()?.provider.searchModels({
          ...narrowed,
          runsOn: LOCAL_RUNTIME,
          limit: EVERY_LOCAL,
        })
      )?.items ?? NONE,
    enabled: parts !== null,
  })

  const pages = useModelPages(['models', 'capability', role], narrowed, parts !== null)

  // The catalogue's first page carries the manifests too, so the swap drops no row and doubles none.
  return pages.pending ? (onThisMachine ?? NONE) : pages.items
}

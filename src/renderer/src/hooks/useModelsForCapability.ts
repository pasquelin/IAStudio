import { partsOfRole, type AiRoleId } from '@shared/domain/aiRole'
import type { ModelSummary } from '@shared/domain/model'
import { useLocalModels } from './useLocalModels'
import { useModelPages } from './useModelPages'

/**
 * Every model that serves this employment, local and cloud. The registry files a manifest under
 * the same `ModelSummary` a catalogue row is, and narrows both by the capability — the studio's
 * own included, which no model publishes.
 */
export function useModelsForCapability(role: AiRoleId | null): readonly ModelSummary[] {
  const parts = role === null ? null : partsOfRole(role)
  // `enabled` below is what makes this non-null; the key already carries the role.
  const narrowed = parts ? { family: parts.family, capabilities: [parts.capability] } : {}

  const onThisMachine = useLocalModels(['models', 'capability', role], narrowed, parts !== null)
  const pages = useModelPages(['models', 'capability', role], narrowed, parts !== null)

  // The catalogue's first page carries the manifests too, so the swap drops no row and doubles none.
  return pages.pending ? onThisMachine : pages.items
}

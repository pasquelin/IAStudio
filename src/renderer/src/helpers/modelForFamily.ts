import type { AiOverview } from '@shared/domain/aiOverview'
import { primaryRoleOf } from '@shared/domain/aiRole'
import type { ModelFamily } from '@shared/domain/model'
import { useAiModels } from '@/stores/aiModels'
import { useModels } from '@/stores/models'
import { useSettings } from '@/stores/settings'

/**
 * Local employment wins; a cloud employment refuses a local leftover; else panel then preference.
 * Absent provider keeps the previous answer — projects without `ai.roles` must still generate.
 */
export function resolveModelForFamily(
  family: ModelFamily,
  selected: string | undefined,
  preferred: string | undefined,
  overview: AiOverview | null,
): string | undefined {
  const role = primaryRoleOf(family)
  const row = role ? overview?.roles.find(one => one.role === role) : undefined
  const provider = row?.provider ?? null
  const localIds = new Set(row?.candidates.map(one => one.model.id) ?? [])

  if (provider?.kind === 'local') return provider.modelId
  if (provider?.kind === 'cloud') {
    if (selected && !localIds.has(selected)) return selected
    if (preferred && !localIds.has(preferred)) return preferred
    return undefined
  }

  return selected ?? preferred
}

/** Whether this id is a model of THIS machine — no account, no browser, no other app. */
export function modelIsOnThisMachine(modelId: string, overview: AiOverview | null): boolean {
  if (overview === null) return false

  return overview.roles.some(
    row =>
      (row.provider?.kind === 'local' && row.provider.modelId === modelId) ||
      row.candidates.some(one => one.model.id === modelId),
  )
}

/** Same answer as `useModelForFamily`, read once, for callers outside React. */
export function modelForFamily(family: ModelFamily): string | undefined {
  const { defaultModels } = useSettings.getState().settings.generation
  return resolveModelForFamily(
    family,
    useModels.getState().selected[family],
    defaultModels[family],
    useAiModels.getState().overview,
  )
}

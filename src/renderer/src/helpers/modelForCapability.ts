import type { AiOverview } from '@shared/domain/aiOverview'
import { primaryRoleOf, type AiRoleId } from '@shared/domain/aiRole'
import type { ModelFamily } from '@shared/domain/model'
import { useAiModels } from '@/stores/aiModels'
import { useModels } from '@/stores/models'

/**
 * The model an EMPLOYMENT generates with — see
 * `docs/ci/adr/ADR-23-la-generation-se-pilote-par-capability.md`.
 *
 * The employment settles WHO serves it, and `providerFor` has already answered that in the main
 * process: `RoleRow.provider` is what a person chose, honoured while it can be. A local choice
 * names its model outright. A cloud names no model at all — it says which account pays — so the
 * model itself is the one picked in the panel.
 */
export function resolveModelForCapability(
  role: AiRoleId,
  selected: string | undefined,
  overview: AiOverview | null,
): string | undefined {
  const row = overview?.roles.find(one => one.role === role)
  const provider = row?.provider ?? null

  if (provider?.kind === 'local') return provider.modelId

  // 🛑 A model of THIS machine is never sent to a cloud: the employment is served by an account,
  // and a leftover local id would be asked of a catalogue that has never heard of it.
  const local = new Set(row?.candidates.map(one => one.model.id) ?? [])
  if (provider?.kind === 'cloud') return selected && !local.has(selected) ? selected : undefined

  return selected
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

/** Same answer as `useModelForCapability`, read once, for callers outside React. */
export function modelForCapability(role: AiRoleId): string | undefined {
  return resolveModelForCapability(
    role,
    useModels.getState().selected[role],
    useAiModels.getState().overview,
  )
}

/**
 * What a family generates with when nothing narrower was asked for — its first employment.
 *
 * Kept for the surfaces that still name a family rather than an operation: the rail deciding
 * whether to draw the generator, and the canvas edits. `null` for `other`, which generates
 * nothing.
 */
export function modelForFamily(family: ModelFamily): string | undefined {
  const role = primaryRoleOf(family)
  return role === null ? undefined : modelForCapability(role)
}

import { z } from 'zod'
import type { ChoiceScope } from '@shared/domain/aiOverview'
import type { AiRoleId, RoleProvider } from '@shared/domain/aiRole'
import { roleProvider } from '@main/settings/validation'

/**
 * What a window sends when it picks a provider for a role.
 *
 * Throws rather than falling back: the choice decides which AI answers, and a provider nothing can
 * serve would leave the role pointing at nowhere. `null` is a real answer — it CLEARS the choice.
 * The shape is the STORE's own, so a choice cannot pass this door and be stripped on the way in.
 */
const choice = z.object({
  role: z.string().min(1),
  provider: roleProvider.nullable(),
  scope: z.enum(['app', 'project']),
})

/**
 * The id of a model a window names. `String(value)` was coercing rather than refusing — it makes
 * `"[object Object]"` out of anything and sends it down to the catalogue.
 */
export function parseModelId(value: unknown): string {
  return z.string().min(1).parse(value)
}

export function parseChoice(
  role: unknown,
  value: unknown,
  scope: unknown,
): { role: AiRoleId; provider: RoleProvider | null; scope: ChoiceScope } {
  const parsed = choice.parse({ role, provider: value, scope })

  // The brand is not re-minted here: the role travels as a string across the boundary, and what
  // makes it valid is that the catalogue answers for it — an unknown one simply matches no row.
  return { ...parsed, role: parsed.role as AiRoleId }
}

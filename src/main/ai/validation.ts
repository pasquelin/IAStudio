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
 * The id of a model a window names — its own schema, the local engine being a domain apart from
 * the Scenario catalogue, under the rule every other id of this boundary follows. `String(value)`
 * was coercing rather than refusing: it makes `"[object Object]"` out of anything.
 */
export function parseAiModelId(value: unknown): string {
  return z.string().trim().min(1).parse(value)
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

const many = z.object({
  writes: z.array(choice.omit({ scope: true })).min(1),
  scope: z.enum(['app', 'project']),
})

export function parseChoices(
  writes: unknown,
  scope: unknown,
): {
  writes: readonly { role: AiRoleId; provider: RoleProvider | null }[]
  scope: ChoiceScope
} {
  const parsed = many.parse({ writes, scope })
  return {
    scope: parsed.scope,
    // Same brand crossing as `parseChoice`: the catalogue is what validates the role, not the cast.
    writes: parsed.writes.map(one => ({ ...one, role: one.role as AiRoleId })),
  }
}

import { z } from 'zod'
import type { ChoiceScope } from '@shared/domain/aiOverview'
import { isCloudProviderId } from '@shared/domain/aiCloud'
import type { AiRoleId, RoleProvider } from '@shared/domain/aiRole'

/**
 * What a window sends when it picks a provider for a role.
 *
 * Throws rather than falling back: the choice decides which AI answers, and a provider nothing can
 * serve would leave the role pointing at nowhere. `null` is a real answer — it CLEARS the choice.
 * The cloud ids come from the registry, so a cloud added is accepted without touching this.
 */
const provider = z.union([
  z.object({ kind: z.literal('local'), modelId: z.string().min(1) }),
  z.object({
    kind: z.literal('cloud'),
    providerId: z.string().refine(id => isCloudProviderId(id)),
  }),
])

const choice = z.object({
  role: z.string().min(1),
  provider: provider.nullable(),
  scope: z.enum(['app', 'project']),
})

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

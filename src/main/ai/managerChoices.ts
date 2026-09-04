import type { AiOverview, ChoiceScope } from '@shared/domain/aiOverview'
import type { AiRoleId, RoleProvider } from '@shared/domain/aiRole'
import type { ManagerDeps } from './managerTypes'
import { withWrites } from './managerHelpers'

export async function chooseProviders(
  deps: ManagerDeps,
  announce: () => Promise<AiOverview>,
  compose: () => Promise<AiOverview>,
  writes: readonly { role: AiRoleId; provider: RoleProvider | null }[],
  scope: ChoiceScope,
): Promise<AiOverview> {
  const stored = deps.settings()
  if (scope === 'app') {
    await deps.writeSettings({ ai: { ...stored.ai, roles: withWrites(stored.ai.roles, writes) } })
    return announce()
  }
  const path = deps.currentProjectPath()
  if (path === null) return compose()
  await deps.writeSettings({
    ai: {
      ...stored.ai,
      projectRoles: {
        ...stored.ai.projectRoles,
        [path]: withWrites(stored.ai.projectRoles[path] ?? {}, writes),
      },
    },
  })
  return announce()
}

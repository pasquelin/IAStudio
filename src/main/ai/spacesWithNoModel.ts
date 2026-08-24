import { primaryRoleOf, type AiRoleId } from '@shared/domain/aiRole'
import { FAMILY_BY_WORKSPACE, WORKSPACE_IDS, type WorkspaceId } from '@shared/domain/workspace'

/** What the six spaces generate with, asked of the manager in one go rather than one per turn. */
export const SPACE_ROLES: readonly AiRoleId[] = WORKSPACE_IDS.flatMap(workspace => {
  const role = primaryRoleOf(FAMILY_BY_WORKSPACE[workspace])
  return role === null ? [] : [role]
})

/**
 * Which spaces the assistant must not promise a picture in, from the roles the manager says
 * nothing serves.
 *
 * 🛑 The PRIMARY employment alone: a space whose `txt2img` is unchosen is named even when its
 * `inpaint` is served. Reading all nineteen would be nineteen weighings per sentence.
 */
export function spacesWithNoModel(unserved: readonly AiRoleId[]): readonly WorkspaceId[] {
  return WORKSPACE_IDS.filter(workspace => {
    const role = primaryRoleOf(FAMILY_BY_WORKSPACE[workspace])
    return role !== null && unserved.includes(role)
  })
}

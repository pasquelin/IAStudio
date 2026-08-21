import { partsOfRole, type AiRoleId } from '@shared/domain/aiRole'

/**
 * What a role is called on screen.
 *
 * Generation roles reuse the words the cloud catalogue already publishes — `families.*` and
 * `capabilities.*` — rather than opening a second vocabulary for the same idea: ADR-21 § A.
 */
export function roleLabel(role: AiRoleId, translate: (key: string) => string): string {
  const parts = partsOfRole(role)
  if (parts === null) return translate(`aiRoles.${role}`)

  return `${translate(`families.${parts.family}`)} · ${translate(`capabilities.${parts.capability}`)}`
}

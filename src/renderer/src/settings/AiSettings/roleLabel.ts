import { partsOfRole, type AiRoleId } from '@shared/domain/aiRole'
import { CAPABILITIES_BY_FAMILY } from '@shared/domain/model'

/**
 * What a role is called on screen.
 *
 * Generation roles reuse the words the cloud catalogue already publishes — `families.*` and
 * `capabilities.*` — rather than opening a second vocabulary for the same idea: ADR-21 § A.
 *
 * A family with ONE employment is named by the family alone: upscaling, cutout and vectorisation
 * each have a single capability that says the same word twice — « Agrandissement · Agrandissement ».
 */
export function roleLabel(role: AiRoleId, translate: (key: string) => string): string {
  const parts = partsOfRole(role)
  if (parts === null) return translate(`aiRoles.${role}`)

  const family = translate(`families.${parts.family}`)
  if (CAPABILITIES_BY_FAMILY[parts.family].length === 1) return family

  return `${family} · ${translate(`capabilities.${parts.capability}`)}`
}

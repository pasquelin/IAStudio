import { contractOf, reworksItsOutput } from './aiCapability'
import type { AiRoleId } from './aiRole'
import { isAssetType } from './asset'

/** Where one generation was asked to go. `newTab` is also what an empty workspace answers. */
export type LandingTarget = 'document' | 'newTab'

export const LANDING_TARGETS: readonly LandingTarget[] = ['document', 'newTab']

/**
 * Where an operation's result belongs, read off its contract — ADR-23.
 *
 * An operation HANDED the medium it produces reworks what it was given; one that starts from a
 * prompt makes something new. Asked only of an operation whose output is NOT a row of the shelf:
 * a picture joins a canvas as a layer, and where that layer goes is not this question.
 */
export function landingOfRole(role: AiRoleId | null): LandingTarget | null {
  if (role === null) return null

  const contract = contractOf(role)
  if (contract === null || isAssetType(contract.output)) return null
  return reworksItsOutput(role) ? 'document' : 'newTab'
}

import {
  contractOf,
  fills,
  reachableFrom,
  type AvailableInput,
  type CapabilityContract,
} from '@shared/domain/aiCapability'
import { aiRoleId, type AiRoleId } from '@shared/domain/aiRole'
import { CAPABILITIES_BY_FAMILY, type ModelFamily } from '@shared/domain/model'

/** Which operation the workspace is about to run: detected, overridable, and never invented. */
export type CapabilityChoice = {
  /** What runs. `null` when nothing of this family can, which the panel says rather than hides. */
  chosen: AiRoleId | null
  /** Every employment of the family the context can reach, in the order the family declares. */
  reachable: readonly AiRoleId[]
  /** Whether `chosen` is what the person asked for rather than what the context suggested. */
  forced: boolean
}

/** How many of an employment's REQUIRED assets the context actually fills. */
function depth(contract: CapabilityContract, available: readonly AvailableInput[]): number {
  return contract.inputs.filter(
    input => input.required && input.kind !== 'text' && fills(input, available),
  ).length
}

/**
 * The suggestion is the employment that USES the most of what is at hand; ties go to the order
 * the family declares. 🛑 Only what the context can REACH is offered: reaching one employment
 * through another is a pipeline nobody implemented, and ADR-23 forbids inventing it.
 */
export function resolveCapability(
  family: ModelFamily,
  available: readonly AvailableInput[],
  forced?: AiRoleId | null,
): CapabilityChoice {
  const offered = CAPABILITIES_BY_FAMILY[family].flatMap(capability => {
    const role = aiRoleId(family, capability)
    const contract = contractOf(role)

    return contract && reachableFrom(contract, available) ? [{ role, contract }] : []
  })
  const reachable = offered.map(one => one.role)

  // What the person asked for wins while it still stands: a selection changing under their hand
  // must not take the operation away from them.
  if (forced && reachable.includes(forced)) return { chosen: forced, reachable, forced: true }

  const best = offered.reduce<{ role: AiRoleId; used: number } | null>((held, one) => {
    const used = depth(one.contract, available)
    return held === null || used > held.used ? { role: one.role, used } : held
  }, null)

  return { chosen: best?.role ?? null, reachable, forced: false }
}

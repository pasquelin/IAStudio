import {
  contractOf,
  reachableFrom,
  type AvailableInput,
  type CapabilityContract,
} from '@shared/domain/aiCapability'
import { aiRoleId, type AiRoleId } from '@shared/domain/aiRole'
import { CAPABILITIES_BY_FAMILY, type ModelFamily } from '@shared/domain/model'

/**
 * Which operation the workspace is about to run — the § 7 of the brief: detected from what is at
 * hand, overridable by the person, and never invented.
 */
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
    input =>
      input.required &&
      input.kind !== 'text' &&
      reachableFrom({ ...contract, inputs: [input] }, available),
  ).length
}

/**
 * The employment the context points at, and every one it could point at instead.
 *
 * The suggestion is the employment that USES the most of what is at hand: a picture alone reads
 * as image-to-image rather than text-to-image, and a picture with a mask reads as a retouch. Ties
 * are broken by the order the family declares its capabilities, which is why `rig` and `motion`
 * are appended — a selected mesh reads as `3d23d` and a rig is asked for by name.
 *
 * 🛑 An employment is offered only when the context can REACH it. Turning a picture into a mesh
 * so that a mesh-to-mesh becomes possible is a pipeline nobody implemented, and ADR-23 forbids
 * inventing one silently.
 */
export function resolveCapability(
  family: ModelFamily,
  available: readonly AvailableInput[],
  forced?: AiRoleId | null,
): CapabilityChoice {
  const reachable = CAPABILITIES_BY_FAMILY[family]
    .map(capability => aiRoleId(family, capability))
    .filter(role => {
      const contract = contractOf(role)
      return contract !== null && reachableFrom(contract, available)
    })

  // What the person asked for wins while it still stands — § 21: a selection changing under
  // their hand must not take the operation away from them.
  if (forced && reachable.includes(forced)) return { chosen: forced, reachable, forced: true }

  let chosen: AiRoleId | null = null
  let best = -1
  for (const role of reachable) {
    const contract = contractOf(role)
    if (!contract) continue

    const used = depth(contract, available)
    if (used > best) {
      best = used
      chosen = role
    }
  }

  return { chosen, reachable, forced: false }
}

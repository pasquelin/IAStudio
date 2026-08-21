import { MODEL_FAMILIES, type ModelFamily } from './model'
import { ASSISTANT_ROLE, partsOfRole, type AiRoleId } from './aiRole'

/**
 * The clouds a role can be served by — a LIST, never a name in a branch.
 *
 * One entry today. What a cloud serves is DATA it declares here, so a role nothing lists is
 * offered no cloud without a single condition being written about it.
 */
export type CloudProviderId = string

export type CloudProvider = {
  readonly id: CloudProviderId
  /** The generation families it publishes. Its capabilities are the studio's own per family. */
  readonly families: readonly ModelFamily[]
  /** The standalone roles it serves. A role absent from every entry is local or nothing. */
  readonly standalone: readonly AiRoleId[]
}

/**
 * The registry, and the ONE place a cloud is named. `[M]` Scenario serves generation — the
 * catalogue this studio is built on — and the assistant, which runs on `model_scenario-llm`, an
 * ordinary model of it. Dictation is absent: nothing here turns speech into text off this machine.
 */
export const CLOUD_PROVIDERS: readonly CloudProvider[] = [
  { id: 'scenario', families: MODEL_FAMILIES, standalone: [ASSISTANT_ROLE] },
]

export const CLOUD_IDS: readonly CloudProviderId[] = CLOUD_PROVIDERS.map(one => one.id)

/** Whether a cloud publishes what this role asks for, read off its declaration. */
function serves(cloud: CloudProvider, role: AiRoleId): boolean {
  const parts = partsOfRole(role)

  return parts === null ? cloud.standalone.includes(role) : cloud.families.includes(parts.family)
}

/** The clouds that could serve a role at all, before any account is held. */
export function cloudsServing(role: AiRoleId): readonly CloudProviderId[] {
  return CLOUD_PROVIDERS.filter(cloud => serves(cloud, role)).map(cloud => cloud.id)
}

/** A cloud id that came from outside the type system — a stored choice, an IPC payload. */
export function isCloudProviderId(value: unknown): value is CloudProviderId {
  return CLOUD_IDS.some(id => id === value)
}

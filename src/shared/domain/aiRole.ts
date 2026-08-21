import { CAPABILITIES_BY_FAMILY, type ModelFamily } from './model'

/**
 * What an AI is FOR — see `docs/ci/adr/ADR-21-le-fournisseur-se-choisit-par-emploi.md`.
 *
 * A space does not have "an AI": image alone has six roles, and `inpaint` is not `txt2img`. Two
 * roles belong to no space at all. The vocabulary is the one the Scenario catalogue already uses,
 * so the local side plugs into it rather than opening a second catalogue nothing could reconcile.
 */

/**
 * `<family>/<capability>` for generation, or one of the two standalone roles.
 *
 * Branded like `RuntimeEndpointId`, and for the same reason: it keys the stored preference, and a
 * malformed key in a record reads as "no choice made" rather than reddening anywhere.
 */
export type AiRoleId = string & { readonly brand: unique symbol }

/** Answers questions, and is the one role a person converses with. */
export const ASSISTANT_ROLE = 'assistant' as AiRoleId

/** Turns speech into text. The only role already served locally today. */
export const DICTATION_ROLE = 'dictation' as AiRoleId

const STANDALONE: readonly AiRoleId[] = [ASSISTANT_ROLE, DICTATION_ROLE]

/**
 * The only way to name a generation role. It throws rather than answering null: a role is composed
 * from constants at a call site, so a malformed one is a programming error.
 */
export function aiRoleId(family: ModelFamily, capability: string): AiRoleId {
  if (!CAPABILITIES_BY_FAMILY[family].includes(capability)) {
    throw new Error(`not a capability of ${family}: ${capability}`)
  }

  // The one cast of this module beyond the two constants: a brand is unforgeable anywhere but here.
  return `${family}/${capability}` as AiRoleId
}

/**
 * Every role the studio has, generation and standalone.
 *
 * Derived from `CAPABILITIES_BY_FAMILY` rather than listed: a family that gains a capability gains
 * its role, and a list written here would drift the day one is added.
 */
export function allRoles(): readonly AiRoleId[] {
  const generation = Object.entries(CAPABILITIES_BY_FAMILY).flatMap(([family, capabilities]) =>
    capabilities.map(capability => `${family}/${capability}` as AiRoleId),
  )

  return [...STANDALONE, ...generation]
}

/** What the role is made of, for a caller that needs to label it. `null` for a standalone one. */
export function partsOfRole(role: AiRoleId): { family: ModelFamily; capability: string } | null {
  const [family, capability, ...rest] = role.split('/')
  if (rest.length > 0 || family === undefined || capability === undefined) return null
  if (!(family in CAPABILITIES_BY_FAMILY)) return null

  return { family: family as ModelFamily, capability }
}

/**
 * Who serves a role. Two REAL providers, and no abstraction for clouds never called from here —
 * writing one would produce types that are plausible and false, and nobody could say which.
 */
export type RoleProvider =
  { readonly kind: 'local'; readonly modelId: string } | { readonly kind: 'scenario' }

/**
 * What the person chose, per role. Absent means "no choice", which is NOT the same as "none":
 * `providerFor` then answers with what is actually available.
 */
export type RoleChoices = Readonly<Partial<Record<AiRoleId, RoleProvider>>>

/** What a role can actually be served by on this machine, right now. */
export type RoleOffer = {
  readonly localModelId: string | null
  readonly scenarioReady: boolean
}

/**
 * What serves a role, choice or not.
 *
 * The LOCAL side wins by default — the whole point of ADR-21 § B: the application has to be useful
 * with no account at all. A key present ADDS a provider to the choice; it does not take the lead.
 * A choice the machine can no longer honour falls back rather than failing.
 */
export function providerFor(
  role: AiRoleId,
  choices: RoleChoices,
  offer: RoleOffer,
): RoleProvider | null {
  const chosen = choices[role]

  if (chosen?.kind === 'local' && chosen.modelId === offer.localModelId) return chosen
  if (chosen?.kind === 'scenario' && offer.scenarioReady) return chosen

  if (offer.localModelId !== null) return { kind: 'local', modelId: offer.localModelId }
  return offer.scenarioReady ? { kind: 'scenario' } : null
}

import { SCENARIO_CLOUD } from './aiCloud'

/**
 * A stored Scenario account, as the renderer may know it. The key and secret never appear
 * here — they stay in the main process, encrypted (see spec § 4, invariant 1).
 */
export type AccountSummary = {
  id: string
  name: string
  /**
   * Which cloud the key opens — the switch groups by it, and one key is active per group.
   * Absent means `scenario`, the same reading `StoredAccount.providerId` gives its own absence.
   */
  providerId?: string
  /** Active FOR ITS CLOUD. Two providers each have one, and they are not exclusive. */
  active: boolean
}

/** Which cloud a key opens. Absent means Scenario — every key written before clouds became a list. */
export function providerOf(account: AccountSummary): string {
  return account.providerId ?? SCENARIO_CLOUD
}

/**
 * The Scenario key in force — the one the catalogue, the green dot and a project link answer for.
 *
 * Here rather than in a store: the main process asks it too, on every project it settles, and the
 * two sides reading the word "active" differently is how a project ends up linked to a key that
 * serves another cloud.
 */
export function scenarioAccount(accounts: readonly AccountSummary[]): AccountSummary | null {
  return accounts.find(account => account.active && providerOf(account) === SCENARIO_CLOUD) ?? null
}

export const ACCOUNT_NAME_MAX_LENGTH = 60

/**
 * What a single-credential install becomes when it grows a list.
 *
 * Untranslated: it is a label the user may rename, not a word of the interface. It named the
 * provider until 21/08 — and that label shows in the title bar's account switch, which made it
 * the last screen still saying who the API belongs to.
 */
export const DEFAULT_ACCOUNT_NAME = 'Default'

/** Why a name was refused. */
export type AccountNameFailure = 'empty' | 'too-long' | 'duplicate'

/**
 * Why a change to the account list was refused. Crosses the boundary as a code.
 *
 * `store-unreadable` means the keychain would not give the stored accounts back. Writing then
 * would replace them all with the one being saved, so the change is refused instead.
 */
export type AccountFailure = AccountNameFailure | 'unknown-account' | 'store-unreadable'

/** Named accounts, whatever else the caller holds about them. */
type Named = { id: string; name: string }

/**
 * Whether a name may be given to an account, `null` when it may. Shared so the field and the
 * writer agree on the rule: the name is required and unique because the header switch shows
 * nothing else, and two entries reading the same would leave the user picking blind.
 *
 * `selfId` exempts the account being renamed, so keeping its own name is not a duplicate.
 */
export function checkAccountName(
  name: string,
  existing: readonly Named[],
  selfId?: string,
): AccountNameFailure | null {
  const trimmed = name.trim()

  if (trimmed.length === 0) return 'empty'
  if (trimmed.length > ACCOUNT_NAME_MAX_LENGTH) return 'too-long'

  const taken = existing.some(
    account => account.id !== selfId && account.name.toLowerCase() === trimmed.toLowerCase(),
  )

  return taken ? 'duplicate' : null
}

/**
 * What every change to the account list answers: the list as it now stands.
 *
 * The authentication state is deliberately absent. Probing it costs a network round trip, and
 * only a change of active key can alter it. A caller that needs it asks `settings.authState()`.
 */
export type AccountsResult = {
  accounts: AccountSummary[]
  /** Set when the change was refused. `accounts` then holds what was already there. */
  failure?: AccountFailure
}

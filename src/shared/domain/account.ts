/**
 * A stored Scenario account, as the renderer may know it. The key and secret never appear
 * here — they stay in the main process, encrypted (see spec § 4, invariant 1).
 */
export type AccountSummary = {
  id: string
  name: string
  active: boolean
}

export const ACCOUNT_NAME_MAX_LENGTH = 60

/** What a single-credential install becomes when it grows a list. */
export const DEFAULT_ACCOUNT_NAME = 'Scenario'

/** Why a name was refused. */
export type AccountNameFailure = 'empty' | 'too-long' | 'duplicate'

/** Why a change to the account list was refused. Crosses the boundary as a code. */
export type AccountFailure = AccountNameFailure | 'unknown-account'

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

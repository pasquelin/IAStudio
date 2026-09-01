import { createHash } from 'node:crypto'
import {
  checkAccountName,
  DEFAULT_ACCOUNT_NAME,
  type AccountFailure,
  type AccountSummary,
} from '@shared/domain/account'
import { SCENARIO_CLOUD, type CloudProviderId } from '@shared/domain/aiCloud'

export type Credentials = {
  key: string
  secret: string
}

/** An account as the main process holds it — the only place the credentials exist in clear. */
export type StoredAccount = {
  id: string
  name: string
  credentials: Credentials
  /**
   * Which cloud the key opens. Absent means `scenario` — every key written before clouds became a
   * list is one, so the migration is the absence itself and no file has to be rewritten.
   */
  providerId?: CloudProviderId
}

const providerOf = (account: StoredAccount): CloudProviderId => account.providerId ?? SCENARIO_CLOUD

/**
 * Every account the studio holds, and which one its calls go through PER CLOUD.
 *
 * One active key per provider rather than one overall: Scenario serves images and another cloud
 * might serve text, so making them exclusive would lose one the moment the other is picked. A
 * generation is billed to a key, and the key is chosen by the model — never by a global mode.
 */
export type AccountBook = {
  accounts: readonly StoredAccount[]
  /** Provider id to account id. A provider with no entry has no active key. */
  activeByProvider: Readonly<Record<string, string>>
}

export const EMPTY_BOOK: AccountBook = { accounts: [], activeByProvider: {} }

/** Carries the reason as a code: a handler translates it, it is never shown as written. */
export class AccountError extends Error {
  constructor(readonly failure: AccountFailure) {
    super(failure)
    this.name = 'AccountError'
  }
}

export function summariesOf(book: AccountBook): AccountSummary[] {
  return book.accounts.map(account => ({
    id: account.id,
    name: account.name,
    // Absent for Scenario, exactly as the stored account leaves it absent: the reader defaults the
    // same way, and every summary carrying a field nobody set would be noise on the wire.
    ...(account.providerId ? { providerId: account.providerId } : {}),
    active: book.activeByProvider[providerOf(account)] === account.id,
  }))
}

/** The key in force for one cloud. `null` when none of its accounts is active, or it holds none. */
export function credentialsFor(book: AccountBook, provider: CloudProviderId): Credentials | null {
  const id = book.activeByProvider[provider]
  return book.accounts.find(account => account.id === id)?.credentials ?? null
}

/** The Scenario key, which is what every call written before clouds became a list still means. */
export function activeCredentials(book: AccountBook): Credentials | null {
  return credentialsFor(book, SCENARIO_CLOUD)
}

/**
 * Which account a key belongs to, in a form that outlives the book entry naming it.
 *
 * The local id will not do: `addAccount` mints a fresh one, so removing a key and adding it
 * back gives the same account a new name — and anything that wrote the old one down, a job left
 * running or a rate-limit window, would no longer find its way back to it. A digest of the key
 * survives that, and it is what may be written to disk: the key itself never is.
 */
export function accountFingerprint(credentials: Credentials): string {
  return createHash('sha256').update(credentials.key).digest('hex')
}

export function credentialsByFingerprint(
  book: AccountBook,
  fingerprint: string,
): Credentials | null {
  const held = book.accounts.find(
    account => accountFingerprint(account.credentials) === fingerprint,
  )
  return held?.credentials ?? null
}

function requireName(name: string, book: AccountBook, selfId?: string): string {
  const failure = checkAccountName(name, book.accounts, selfId)
  if (failure) throw new AccountError(failure)
  return name.trim()
}

function requireHeld(book: AccountBook, id: string): StoredAccount {
  const account = book.accounts.find(candidate => candidate.id === id)
  if (!account) throw new AccountError('unknown-account')
  return account
}

/**
 * Adds an account, activating it only when it is the first. A second key must not redirect
 * every call the moment it is saved: the user was configuring, not switching.
 */
export function addAccount(book: AccountBook, account: StoredAccount): AccountBook {
  const accounts = [...book.accounts, { ...account, name: requireName(account.name, book) }]
  const provider = providerOf(account)
  // Active only where its cloud had none: the FIRST key of a cloud is different from the second,
  // since without it that cloud has nothing at all.
  const activeByProvider = book.activeByProvider[provider]
    ? book.activeByProvider
    : { ...book.activeByProvider, [provider]: account.id }

  return { accounts, activeByProvider }
}

export function renameAccount(book: AccountBook, id: string, name: string): AccountBook {
  requireHeld(book, id)
  const renamed = requireName(name, book, id)

  return {
    ...book,
    accounts: book.accounts.map(account =>
      account.id === id ? { ...account, name: renamed } : account,
    ),
  }
}

/**
 * Removes an account, falling back to the first one left when it was the active one. Being
 * left with no account at all while others are held would read as a broken sign-out.
 */
export function removeAccount(book: AccountBook, id: string): AccountBook {
  const provider = providerOf(requireHeld(book, id))
  const accounts = book.accounts.filter(account => account.id !== id)

  if (book.activeByProvider[provider] !== id) return { ...book, accounts }

  // Falls back inside its OWN cloud: being left with no key there while others are held would
  // read as a broken sign-out, and a key of another cloud cannot answer for this one.
  const successor = accounts.find(account => providerOf(account) === provider)
  const rest = Object.fromEntries(
    Object.entries(book.activeByProvider).filter(([key]) => key !== provider),
  )

  return {
    accounts,
    activeByProvider: successor ? { ...rest, [provider]: successor.id } : rest,
  }
}

export function activateAccount(book: AccountBook, id: string): AccountBook {
  const account = requireHeld(book, id)
  return {
    ...book,
    activeByProvider: { ...book.activeByProvider, [providerOf(account)]: id },
  }
}

/**
 * The book a single-credential install becomes. The name is not translated: it labels a key
 * the user is free to rename, and one that changed with the language would stop matching what
 * the switch showed yesterday.
 */
export function bookFromCredentials(credentials: Credentials, id: string): AccountBook {
  return {
    accounts: [{ id, name: DEFAULT_ACCOUNT_NAME, credentials }],
    activeByProvider: { [SCENARIO_CLOUD]: id },
  }
}

/**
 * Settles a book read back from disk: drops entries sharing an id, and repoints every choice that
 * names nothing — or names a key of another cloud. Repairing beats refusing: the alternative is a
 * studio that cannot reach the API and cannot say which of its keys is at fault.
 *
 * Every cloud that HOLDS a key ends up with an active one, which is what makes an absent entry
 * mean "this cloud has no key" rather than "nothing was chosen yet".
 */
export function settleBook(book: AccountBook): AccountBook {
  const seen = new Set<string>()
  const accounts = book.accounts.filter(account => {
    if (seen.has(account.id)) return false
    seen.add(account.id)
    return true
  })

  const activeByProvider: Record<string, string> = {}
  for (const account of accounts) {
    const provider = providerOf(account)
    if (activeByProvider[provider]) continue

    const chosen = accounts.find(
      candidate =>
        candidate.id === book.activeByProvider[provider] && providerOf(candidate) === provider,
    )
    // The head of that cloud's own list, when the stored pointer names nothing here.
    activeByProvider[provider] = chosen?.id ?? account.id
  }

  return { accounts, activeByProvider }
}

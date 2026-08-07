import {
  checkAccountName,
  DEFAULT_ACCOUNT_NAME,
  type AccountFailure,
  type AccountSummary,
} from '@shared/domain/account'

export type Credentials = {
  key: string
  secret: string
}

/** An account as the main process holds it — the only place the credentials exist in clear. */
export type StoredAccount = {
  id: string
  name: string
  credentials: Credentials
}

/** Every account the studio holds, and which one its calls go through. */
export type AccountBook = {
  accounts: readonly StoredAccount[]
  /** Null when the book is empty. Always names a held account otherwise. */
  activeId: string | null
}

export const EMPTY_BOOK: AccountBook = { accounts: [], activeId: null }

/** Carries the reason as a code: a handler translates it, it is never shown as written. */
export class AccountError extends Error {
  constructor(readonly failure: AccountFailure) {
    super(failure)
    this.name = 'AccountError'
  }
}

export function summariesOf(book: AccountBook): AccountSummary[] {
  return book.accounts.map(({ id, name }) => ({ id, name, active: id === book.activeId }))
}

export function activeCredentials(book: AccountBook): Credentials | null {
  return book.accounts.find(account => account.id === book.activeId)?.credentials ?? null
}

function requireName(name: string, book: AccountBook, selfId?: string): string {
  const failure = checkAccountName(name, book.accounts, selfId)
  if (failure) throw new AccountError(failure)
  return name.trim()
}

function requireHeld(book: AccountBook, id: string): void {
  if (!book.accounts.some(account => account.id === id)) throw new AccountError('unknown-account')
}

/**
 * Adds an account, activating it only when it is the first. A second key must not redirect
 * every call the moment it is saved: the user was configuring, not switching.
 */
export function addAccount(book: AccountBook, account: StoredAccount): AccountBook {
  const accounts = [...book.accounts, { ...account, name: requireName(account.name, book) }]
  return { accounts, activeId: book.activeId ?? account.id }
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
  requireHeld(book, id)
  const accounts = book.accounts.filter(account => account.id !== id)

  return { accounts, activeId: book.activeId === id ? (accounts[0]?.id ?? null) : book.activeId }
}

export function activateAccount(book: AccountBook, id: string): AccountBook {
  requireHeld(book, id)
  return { ...book, activeId: id }
}

/**
 * The book a single-credential install becomes. The name is not translated: it labels a key
 * the user is free to rename, and one that changed with the language would stop matching what
 * the switch showed yesterday.
 */
export function bookFromCredentials(credentials: Credentials, id: string): AccountBook {
  return { accounts: [{ id, name: DEFAULT_ACCOUNT_NAME, credentials }], activeId: id }
}

/**
 * Settles a book read back from disk: drops entries sharing an id, and repoints an `activeId`
 * that names nothing. Repairing beats refusing — the alternative is a studio that cannot reach
 * the API and cannot say which of its keys is at fault.
 */
export function settleBook(book: AccountBook): AccountBook {
  const seen = new Set<string>()
  const accounts = book.accounts.filter(account => {
    if (seen.has(account.id)) return false
    seen.add(account.id)
    return true
  })

  const active = accounts.some(account => account.id === book.activeId)
  return { accounts, activeId: active ? book.activeId : (accounts[0]?.id ?? null) }
}

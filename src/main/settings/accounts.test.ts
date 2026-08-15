import { describe, expect, it } from 'vitest'
import { DEFAULT_ACCOUNT_NAME, ENVIRONMENT_ACCOUNT_ID } from '@shared/domain/account'
import {
  accountFingerprint,
  activateAccount,
  activeCredentials,
  addAccount,
  bookFromCredentials,
  credentialsByFingerprint,
  EMPTY_BOOK,
  removeAccount,
  renameAccount,
  settleBook,
  summariesOf,
  withEnvironment,
  withoutEnvironment,
  type AccountBook,
  type StoredAccount,
} from '@main/settings/accounts'

const account = (id: string, name: string): StoredAccount => ({
  id,
  name,
  credentials: { key: `key-${id}`, secret: `secret-${id}` },
})

const bookOf = (...names: string[]): AccountBook =>
  names.reduce((book, name, index) => addAccount(book, account(`id-${index}`, name)), EMPTY_BOOK)

describe('addAccount', () => {
  it('activates the first account, so a fresh install is usable at once', () => {
    const book = addAccount(EMPTY_BOOK, account('a', 'Studio'))
    expect(book.activeId).toBe('a')
  })

  // Saving a second key is configuring, not switching: redirecting every call would move the
  // library out from under the user mid-task.
  it('leaves the active account alone when another is added', () => {
    const book = bookOf('Studio', 'Client X')
    expect(book.activeId).toBe('id-0')
  })

  it('stores the name trimmed', () => {
    const book = addAccount(EMPTY_BOOK, account('a', '  Studio  '))
    expect(book.accounts[0]?.name).toBe('Studio')
  })

  it('refuses a name another account holds', () => {
    expect(() => addAccount(bookOf('Studio'), account('b', 'studio'))).toThrow('duplicate')
  })

  it('refuses a blank name', () => {
    expect(() => addAccount(EMPTY_BOOK, account('a', '  '))).toThrow('empty')
  })
})

describe('summariesOf', () => {
  it('marks the active account and carries no credentials', () => {
    const summaries = summariesOf(bookOf('Studio', 'Client X'))

    expect(summaries).toEqual([
      { id: 'id-0', name: 'Studio', active: true },
      { id: 'id-1', name: 'Client X', active: false },
    ])
  })
})

describe('activeCredentials', () => {
  it('answers the credentials of the active account', () => {
    expect(activeCredentials(bookOf('Studio'))).toEqual({ key: 'key-id-0', secret: 'secret-id-0' })
  })

  it('answers null on an empty book', () => {
    expect(activeCredentials(EMPTY_BOOK)).toBeNull()
  })

  it('follows a switch', () => {
    const switched = activateAccount(bookOf('Studio', 'Client X'), 'id-1')
    expect(activeCredentials(switched)?.key).toBe('key-id-1')
  })
})

describe('renameAccount', () => {
  it('renames without touching the others', () => {
    const book = renameAccount(bookOf('Studio', 'Client X'), 'id-1', 'Client Y')
    expect(book.accounts.map(entry => entry.name)).toEqual(['Studio', 'Client Y'])
  })

  it('lets an account keep its own name', () => {
    expect(() => renameAccount(bookOf('Studio'), 'id-0', 'Studio')).not.toThrow()
  })

  it('refuses a sibling name', () => {
    expect(() => renameAccount(bookOf('Studio', 'Client X'), 'id-1', 'Studio')).toThrow('duplicate')
  })

  it('refuses an account it does not hold', () => {
    expect(() => renameAccount(bookOf('Studio'), 'ghost', 'Other')).toThrow('unknown-account')
  })
})

describe('removeAccount', () => {
  it('falls back to the first account left when the active one goes', () => {
    const book = removeAccount(bookOf('Studio', 'Client X'), 'id-0')
    expect(book.activeId).toBe('id-1')
  })

  it('leaves the active account alone when another goes', () => {
    const book = removeAccount(bookOf('Studio', 'Client X'), 'id-1')
    expect(book.activeId).toBe('id-0')
  })

  it('empties the active id with the last account', () => {
    expect(removeAccount(bookOf('Studio'), 'id-0')).toEqual(EMPTY_BOOK)
  })

  it('refuses an account it does not hold', () => {
    expect(() => removeAccount(bookOf('Studio'), 'ghost')).toThrow('unknown-account')
  })

  it('frees the name it held', () => {
    const book = removeAccount(bookOf('Studio', 'Client X'), 'id-0')
    expect(() => renameAccount(book, 'id-1', 'Studio')).not.toThrow()
  })
})

describe('activateAccount', () => {
  it('refuses an account it does not hold, rather than leaving nothing active', () => {
    expect(() => activateAccount(bookOf('Studio'), 'ghost')).toThrow('unknown-account')
  })
})

describe('bookFromCredentials', () => {
  it('turns a lone stored pair into one active, named account', () => {
    const book = bookFromCredentials({ key: 'k', secret: 's' }, 'a')

    expect(book).toEqual({
      accounts: [{ id: 'a', name: DEFAULT_ACCOUNT_NAME, credentials: { key: 'k', secret: 's' } }],
      activeId: 'a',
    })
  })
})

describe('settleBook', () => {
  it('repoints an active id that names nothing', () => {
    const book = settleBook({ accounts: [account('a', 'Studio')], activeId: 'ghost' })
    expect(book.activeId).toBe('a')
  })

  it('drops entries sharing an id, keeping the first', () => {
    const book = settleBook({
      accounts: [account('a', 'Studio'), account('a', 'Twin')],
      activeId: 'a',
    })

    expect(book.accounts).toHaveLength(1)
    expect(book.accounts[0]?.name).toBe('Studio')
  })

  it('leaves a sound book untouched', () => {
    const sound = bookOf('Studio', 'Client X')
    expect(settleBook(sound)).toEqual(sound)
  })

  it('empties the active id of an empty book', () => {
    expect(settleBook(EMPTY_BOOK)).toEqual(EMPTY_BOOK)
  })
})

/**
 * The account `secrets/.env` stands for. It is composed on every read and stripped before every
 * write: the file is the truth about it, so a copy in the keychain could only go stale.
 */
describe('the development account', () => {
  const environment: StoredAccount = {
    id: ENVIRONMENT_ACCOUNT_ID,
    name: 'Development',
    credentials: { key: 'env_key', secret: 'env_secret' },
    origin: 'environment',
  }

  /** As the store reads it: composed, then repaired — the order the two run in. */
  const composed = (book: AccountBook): AccountBook =>
    settleBook(withEnvironment(book, environment))

  it('leads the list and takes the switch when nothing else was chosen', () => {
    const book = composed({ ...bookOf('Studio'), activeId: null })

    expect(book.accounts.map(entry => entry.name)).toEqual(['Development', 'Studio'])
    expect(book.activeId).toBe(ENVIRONMENT_ACCOUNT_ID)
  })

  it('leaves a stored account that was chosen exactly where it is', () => {
    const book = composed({ ...bookOf('Studio', 'Client X'), activeId: 'id-1' })

    expect(book.activeId).toBe('id-1')
  })

  // A `.env` gone since the last launch: the choice it left behind names nothing.
  it('repoints a stored choice that no longer names an account', () => {
    const orphaned = { ...bookOf('Studio'), activeId: ENVIRONMENT_ACCOUNT_ID }

    expect(settleBook(withEnvironment(orphaned, null)).activeId).toBe('id-0')
  })

  it('changes nothing outside development', () => {
    const stored = bookOf('Studio')
    expect(withEnvironment(stored, null)).toEqual(stored)
  })

  it('never reaches what gets persisted', () => {
    const book = composed(bookOf('Studio'))

    expect(withoutEnvironment(book).accounts.map(entry => entry.id)).toEqual(['id-0'])
  })

  // The choice outlives the account it names: the file is very likely there again next launch,
  // and repointing it early is what would send that launch to the wrong key.
  it('keeps the choice of it when stripping, so activating it survives a relaunch', () => {
    const book = composed({ ...bookOf('Studio'), activeId: null })

    expect(withoutEnvironment(book).activeId).toBe(ENVIRONMENT_ACCOUNT_ID)
  })

  // The window is told the permission, never where the key is kept.
  it('is announced to the renderer as read-only', () => {
    expect(summariesOf(composed(bookOf('Studio')))).toEqual([
      { id: ENVIRONMENT_ACCOUNT_ID, name: 'Development', active: false, readOnly: true },
      { id: 'id-0', name: 'Studio', active: true },
    ])
  })

  it('refuses to be renamed or removed — that is what the file is for', () => {
    const book = composed(EMPTY_BOOK)

    expect(() => renameAccount(book, ENVIRONMENT_ACCOUNT_ID, 'Mine')).toThrow('read-only-account')
    expect(() => removeAccount(book, ENVIRONMENT_ACCOUNT_ID)).toThrow('read-only-account')
  })

  it('is switched to like any other', () => {
    const book = composed({ ...bookOf('Studio'), activeId: 'id-0' })

    expect(activateAccount(book, ENVIRONMENT_ACCOUNT_ID).activeId).toBe(ENVIRONMENT_ACCOUNT_ID)
  })

  // It is in the book, so it takes part in the uniqueness the header switch depends on.
  it('holds its name against a stored account taking the same one', () => {
    expect(() => addAccount(composed(EMPTY_BOOK), account('id-9', 'Development'))).toThrow(
      'duplicate',
    )
  })
})

/**
 * A job left running names the account that paid for it, and has to find its way back after the
 * studio was closed. The book entry cannot answer that: it is renewed on a remove-and-re-add.
 */
describe('naming an account by its key', () => {
  const key = { key: 'api_k', secret: 's3cr3t' }

  it('names the same key the same way, whatever the book entry around it', () => {
    expect(accountFingerprint(key)).toBe(accountFingerprint({ ...key, secret: 'rotated' }))
  })

  it('names two keys differently', () => {
    expect(accountFingerprint(key)).not.toBe(accountFingerprint({ ...key, key: 'api_other' }))
  })

  // It goes to disk. The key itself never does.
  it('never puts the key in the name', () => {
    expect(accountFingerprint(key)).not.toContain(key.key)
  })

  it('finds the credentials behind a name it gave', () => {
    const book = { accounts: [{ id: 'id-1', name: 'Studio', credentials: key }], activeId: 'id-1' }

    expect(credentialsByFingerprint(book, accountFingerprint(key))).toEqual(key)
  })

  // What happens to a job whose account has been removed since: it fails rather than 404s.
  it('answers nothing for a key the book no longer holds', () => {
    expect(credentialsByFingerprint(EMPTY_BOOK, accountFingerprint(key))).toBeNull()
  })
})

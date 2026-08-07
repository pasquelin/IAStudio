import { describe, expect, it } from 'vitest'
import { DEFAULT_ACCOUNT_NAME } from '@shared/domain/account'
import {
  activateAccount,
  activeCredentials,
  addAccount,
  bookFromCredentials,
  EMPTY_BOOK,
  removeAccount,
  renameAccount,
  settleBook,
  summariesOf,
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

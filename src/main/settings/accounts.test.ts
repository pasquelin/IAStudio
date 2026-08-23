import { describe, expect, it } from 'vitest'
import { DEFAULT_ACCOUNT_NAME } from '@shared/domain/account'
import { SCENARIO_CLOUD } from '@shared/domain/aiCloud'
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

/**
 * The Scenario choice, which is what "the active account" meant before clouds became a list.
 * Every account of these cases is one, so this reads the single entry the book carries.
 */
const activeIdOf = (book: AccountBook): string | null =>
  book.activeByProvider[SCENARIO_CLOUD] ?? null

const activeAt = (id: string | null): Pick<AccountBook, 'activeByProvider'> => ({
  activeByProvider: id === null ? {} : { [SCENARIO_CLOUD]: id },
})

describe('addAccount', () => {
  it('activates the first account, so a fresh install is usable at once', () => {
    const book = addAccount(EMPTY_BOOK, account('a', 'Studio'))
    expect(activeIdOf(book)).toBe('a')
  })

  // Saving a second key is configuring, not switching: redirecting every call would move the
  // library out from under the user mid-task.
  it('leaves the active account alone when another is added', () => {
    const book = bookOf('Studio', 'Client X')
    expect(activeIdOf(book)).toBe('id-0')
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
    expect(activeIdOf(book)).toBe('id-1')
  })

  it('leaves the active account alone when another goes', () => {
    const book = removeAccount(bookOf('Studio', 'Client X'), 'id-1')
    expect(activeIdOf(book)).toBe('id-0')
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
      ...activeAt('a'),
    })
  })
})

/**
 * Scenario serves images while another cloud might serve text, so making them exclusive would
 * lose one the moment the other is picked. One active key PER cloud, and a fallback that never
 * crosses over — a key of another cloud cannot answer for this one.
 */
describe('one active key per cloud', () => {
  const at = (id: string, provider: string): StoredAccount => ({
    ...account(id, `Key ${id}`),
    providerId: provider,
  })

  // The Scenario side carries NO `providerId`, which is what every key stored before clouds became
  // a list looks like: the migration is that absence, and no file is rewritten for it.
  const twoClouds = (): AccountBook =>
    addAccount(addAccount(EMPTY_BOOK, account('s1', 'Key s1')), at('g1', 'google'))

  it('activates the first key of each cloud, and neither displaces the other', () => {
    const book = twoClouds()

    expect(book.activeByProvider).toEqual({ [SCENARIO_CLOUD]: 's1', google: 'g1' })
  })

  it('leaves the other cloud alone when a second key joins one of them', () => {
    const book = addAccount(twoClouds(), account('s2', 'Key s2'))

    expect(book.activeByProvider).toEqual({ [SCENARIO_CLOUD]: 's1', google: 'g1' })
  })

  it('switches within a cloud, and only there', () => {
    const book = activateAccount(addAccount(twoClouds(), at('s2', SCENARIO_CLOUD)), 's2')

    expect(book.activeByProvider).toEqual({ [SCENARIO_CLOUD]: 's2', google: 'g1' })
  })

  it('falls back inside the cloud the removed key belonged to', () => {
    const book = removeAccount(addAccount(twoClouds(), at('s2', SCENARIO_CLOUD)), 's1')

    expect(book.activeByProvider).toEqual({ [SCENARIO_CLOUD]: 's2', google: 'g1' })
  })

  // A cloud with no key left has no entry, which is what tells "holds nothing" from "chose none".
  it('drops the entry when the cloud is left with nothing', () => {
    const book = removeAccount(twoClouds(), 'g1')

    expect(book.activeByProvider).toEqual({ [SCENARIO_CLOUD]: 's1' })
  })

  it('carries the cloud out to the window, absent for Scenario', () => {
    const summaries = summariesOf(twoClouds())

    expect(summaries.find(one => one.id === 'g1')?.providerId).toBe('google')
    expect(summaries.find(one => one.id === 's1')?.providerId).toBeUndefined()
  })
})

describe('settleBook', () => {
  it('repoints an active id that names nothing', () => {
    const book = settleBook({ accounts: [account('a', 'Studio')], ...activeAt('ghost') })
    expect(activeIdOf(book)).toBe('a')
  })

  it('drops entries sharing an id, keeping the first', () => {
    const book = settleBook({
      accounts: [account('a', 'Studio'), account('a', 'Twin')],
      ...activeAt('a'),
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
    const book = {
      accounts: [{ id: 'id-1', name: 'Studio', credentials: key }],
      ...activeAt('id-1'),
    }

    expect(credentialsByFingerprint(book, accountFingerprint(key))).toEqual(key)
  })

  // What happens to a job whose account has been removed since: it fails rather than 404s.
  it('answers nothing for a key the book no longer holds', () => {
    expect(credentialsByFingerprint(EMPTY_BOOK, accountFingerprint(key))).toBeNull()
  })
})

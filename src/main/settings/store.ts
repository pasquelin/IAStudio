import { randomUUID } from 'node:crypto'
import type { AccountSummary } from '@shared/domain/account'
import { DEFAULT_SETTINGS, type PartialSettings, type Settings } from '@shared/domain/settings'
import {
  AccountError,
  activateAccount,
  activeCredentials,
  addAccount,
  bookFromCredentials,
  EMPTY_BOOK,
  removeAccount,
  renameAccount,
  summariesOf,
  type AccountBook,
  type Credentials,
} from './accounts'
import { parseStoredAccounts, parseStoredCredentials, salvagePartialSettings } from './validation'

/**
 * What the store needs in order to persist. Injected so tests need neither Electron nor a
 * disk: `safeStorage` does not exist outside a packaged application.
 */
export type PersistenceAdapter = {
  read: <T>(key: string) => T | undefined
  write: (key: string, value: unknown) => void
  remove: (key: string) => void
  encrypt: (plain: string) => string
  decrypt: (encrypted: string) => string
  /** Where it writes, for the settings screen's "reveal the file" button. */
  path: () => string
}

/**
 * What a change to the account list did. `credentialsChanged` is derived from the book, not
 * claimed by the caller: adding a second account or removing an idle one leaves the active key
 * exactly where it was, and treating those as a switch would throw away every cache for nothing.
 */
export type AccountChange = {
  accounts: AccountSummary[]
  credentialsChanged: boolean
}

export type SettingsStore = {
  read: () => Settings
  write: (partial: PartialSettings) => Settings
  /**
   * Back to a fresh install. Not `write(DEFAULT_SETTINGS)`: a write MERGES, and the settings
   * with no default — an accent, an ffmpeg path, a projects folder — have nothing in the
   * defaults to overwrite them, so they would survive the reset that promised to remove them.
   */
  reset: () => Settings
  /** Every held account, without its credentials — this is what may cross to a window. */
  accounts: () => AccountSummary[]
  /** Throws an `AccountError` when the name is blank, too long, or already taken. */
  addAccount: (name: string, credentials: Credentials) => AccountChange
  renameAccount: (id: string, name: string) => AccountChange
  removeAccount: (id: string) => AccountChange
  activateAccount: (id: string) => AccountChange
  hasCredentials: () => boolean
  /**
   * Carries a lone stored pair over into a book, and drops a book that can no longer be read
   * so the user is asked again. Called once at startup, never from a read.
   */
  settleAccounts: () => void
  /** Main process only. Never expose over IPC — see spec § 4, invariant 1. */
  readCredentials: () => Credentials | null
  /** Where the settings are written. */
  path: () => string
}

const SETTINGS_KEY = 'settings'
const CREDENTIALS_KEY = 'credentials'
const ACCOUNTS_KEY = 'accounts'

/**
 * The id a migrated lone pair lands under. Fixed rather than generated: the migration is read
 * before it is ever written, and a fresh id per read would hand every caller a different
 * account for the same key.
 */
const MIGRATED_ACCOUNT_ID = 'account_migrated'

function merge(base: Settings, partial: PartialSettings): Settings {
  return {
    general: { ...base.general, ...partial.general },
    appearance: { ...base.appearance, ...partial.appearance },
    generation: { ...base.generation, ...partial.generation },
    storage: { ...base.storage, ...partial.storage },
    three: { ...base.three, ...partial.three },
    shortcuts: { ...base.shortcuts, ...partial.shortcuts },
    media: { ...base.media, ...partial.media },
    advanced: { ...base.advanced, ...partial.advanced },
  }
}

/**
 * Every write goes through here, wherever it came from — the settings window, or the main
 * process recording the project it just opened — so notifying from the store rather than from
 * the IPC handler is what makes "one window changed a setting" reach all of them.
 */
export type SettingsStoreOptions = {
  onChange?: (settings: Settings) => void
  /** Injected so a test can name the accounts it creates. */
  newAccountId?: () => string
}

export function createSettingsStore(
  adapter: PersistenceAdapter,
  { onChange, newAccountId = () => `account_${randomUUID()}` }: SettingsStoreOptions = {},
): SettingsStore {
  const read = (): Settings =>
    merge(DEFAULT_SETTINGS, salvagePartialSettings(adapter.read(SETTINGS_KEY)))

  const readRaw = (key: string): string | null => adapter.read<string>(key) ?? null

  /** Answers null on anything unreadable: keychain changed, profile migrated, data corrupted. */
  const decrypt = <T>(raw: string, parse: (plain: string) => T | null): T | null => {
    try {
      return parse(adapter.decrypt(raw))
    } catch {
      return null
    }
  }

  /**
   * A stored book that would not decrypt is kept apart from one that is simply not there. The
   * two look alike to a reader and could not be more different to a writer: a locked keychain
   * must never be answered by writing over the keys it is holding.
   */
  type StoredBook = { held: 'none' } | { held: 'unreadable' } | { held: 'book'; book: AccountBook }

  const storedBook = (): StoredBook => {
    const raw = readRaw(ACCOUNTS_KEY)
    if (!raw) return { held: 'none' }

    const book = decrypt(raw, parseStoredAccounts)
    return book ? { held: 'book', book } : { held: 'unreadable' }
  }

  /**
   * Reads without side effects. An unreadable book reads as empty so the screens ask for a key
   * rather than claim to be set up — never as a reason to erase it.
   *
   * With no book at all, a lone pair from a single-credential install stands in for one, so
   * an upgrade keeps working before `settleAccounts` has had a chance to carry it over.
   */
  const readBook = (): AccountBook => {
    const stored = storedBook()
    if (stored.held !== 'none') return stored.held === 'book' ? stored.book : EMPTY_BOOK

    const lone = readRaw(CREDENTIALS_KEY)
    const credentials = lone && decrypt(lone, parseStoredCredentials)
    return credentials ? bookFromCredentials(credentials, MIGRATED_ACCOUNT_ID) : EMPTY_BOOK
  }

  const writeBook = (book: AccountBook): void => {
    adapter.write(ACCOUNTS_KEY, adapter.encrypt(JSON.stringify(book)))
  }

  /** Runs one change and reports whether it moved the active key — never guessed by a caller. */
  const apply = (change: (book: AccountBook) => AccountBook): AccountChange => {
    const stored = storedBook()

    /*
     * A write replaces the blob whole. Adding an account on top of a book we could not read
     * would therefore leave a book of one where the user had several — and the screen invites
     * exactly that, since an unreadable book reads as "no account yet". Refusing is the only
     * answer that keeps the keys: the next launch, with the keychain back, reads them fine.
     */
    if (stored.held === 'unreadable') throw new AccountError('store-unreadable')

    const before = stored.held === 'book' ? stored.book : readBook()
    const after = change(before)
    writeBook(after)

    return { accounts: summariesOf(after), credentialsChanged: before.activeId !== after.activeId }
  }

  return {
    read,

    write: partial => {
      const merged = merge(read(), partial)
      adapter.write(SETTINGS_KEY, merged)
      onChange?.(merged)
      return merged
    },

    reset: () => {
      adapter.write(SETTINGS_KEY, DEFAULT_SETTINGS)
      onChange?.(DEFAULT_SETTINGS)
      return DEFAULT_SETTINGS
    },

    accounts: () => summariesOf(readBook()),

    addAccount: (name, credentials) =>
      apply(book => addAccount(book, { id: newAccountId(), name, credentials })),

    renameAccount: (id, name) => apply(book => renameAccount(book, id, name)),

    removeAccount: id => apply(book => removeAccount(book, id)),

    activateAccount: id => apply(book => activateAccount(book, id)),

    hasCredentials: () => activeCredentials(readBook()) !== null,

    settleAccounts: () => {
      const stored = storedBook()

      // Nothing is touched. This runs before the first window, where a keychain can be locked
      // or unavailable for the launch: erasing the book would cost every key the user holds,
      // and erasing the pair beside it would cost the one copy that migration may still need.
      if (stored.held === 'unreadable') return

      // A readable book is proof the pair was superseded. Left behind, it would outlive
      // "remove every account", which no longer touches it.
      if (stored.held === 'book') {
        if (readRaw(CREDENTIALS_KEY)) adapter.remove(CREDENTIALS_KEY)
        return
      }

      const lone = readRaw(CREDENTIALS_KEY)
      const credentials = lone && decrypt(lone, parseStoredCredentials)
      // An undecryptable pair is kept for the same reason as an unreadable book: it is the
      // only copy of the key, and the next launch may well read it.
      if (!credentials) return

      try {
        writeBook(bookFromCredentials(credentials, MIGRATED_ACCOUNT_ID))
        adapter.remove(CREDENTIALS_KEY)
      } catch {
        // No keychain on this machine, so nothing can be encrypted. The pair stays where it
        // is and `readBook` keeps standing in for it — failing the launch over a migration
        // that can wait would be worse.
      }
    },

    readCredentials: () => activeCredentials(readBook()),

    path: adapter.path,
  }
}

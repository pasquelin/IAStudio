import { randomUUID } from 'node:crypto'
import type { AccountSummary } from '@shared/domain/account'
import { DEFAULT_SETTINGS, type PartialSettings, type Settings } from '@shared/domain/settings'
import {
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
   * Reads without side effects. An unreadable book is reported empty, not deleted: erasing
   * from a read would make `accounts()` destructive, and a transient keychain failure would
   * silently cost the user every key they hold.
   *
   * With no book at all, a lone pair from a single-credential install stands in for one, so
   * an upgrade keeps working before `settleAccounts` has had a chance to carry it over.
   */
  const readBook = (): AccountBook => {
    const stored = readRaw(ACCOUNTS_KEY)
    if (stored) return decrypt(stored, parseStoredAccounts) ?? EMPTY_BOOK

    const lone = readRaw(CREDENTIALS_KEY)
    const credentials = lone && decrypt(lone, parseStoredCredentials)
    return credentials ? bookFromCredentials(credentials, MIGRATED_ACCOUNT_ID) : EMPTY_BOOK
  }

  const writeBook = (book: AccountBook): void => {
    adapter.write(ACCOUNTS_KEY, adapter.encrypt(JSON.stringify(book)))
  }

  /** Runs one change and reports whether it moved the active key — never guessed by a caller. */
  const apply = (change: (book: AccountBook) => AccountBook): AccountChange => {
    const before = readBook()
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
      const stored = readRaw(ACCOUNTS_KEY)

      if (stored) {
        // Unreadable rather than merely empty: keeping it would leave every future write
        // merging onto a blob nothing can read.
        if (decrypt(stored, parseStoredAccounts) === null) adapter.remove(ACCOUNTS_KEY)
      } else {
        const book = readBook()
        if (book.accounts.length > 0) writeBook(book)
      }

      // Whichever branch ran: the pair was either carried over just now or superseded by a
      // book long ago. Leaving it would keep a secret that removing every account no longer
      // erases — and the read is what keeps a startup with nothing stored off the disk.
      if (readRaw(CREDENTIALS_KEY)) adapter.remove(CREDENTIALS_KEY)
    },

    readCredentials: () => activeCredentials(readBook()),

    path: adapter.path,
  }
}

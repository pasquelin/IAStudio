import { randomUUID } from 'node:crypto'
import type { AccountSummary } from '@shared/domain/account'
import { DEFAULT_SETTINGS, type PartialSettings, type Settings } from '@shared/domain/settings'
import {
  AccountError,
  activateAccount,
  activeCredentials,
  addAccount,
  credentialsByFingerprint,
  bookFromCredentials,
  EMPTY_BOOK,
  removeAccount,
  renameAccount,
  settleBook,
  summariesOf,
  withEnvironment,
  withoutEnvironment,
  type AccountBook,
  type Credentials,
  type StoredAccount,
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

/** An account as the main process may use it to call the API on that account's behalf. */
export type KeyedAccount = {
  id: string
  name: string
  credentials: Credentials
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
  /**
   * The same accounts, credentials included. Main process only: nothing here may cross to a
   * window. Exists so usage can be read for every stored key at once, not just the active one.
   */
  keyedAccounts: () => KeyedAccount[]
  /** All four throw an `AccountError`: a refused name, an unknown id, or a locked keychain. */
  addAccount: (name: string, credentials: Credentials) => AccountChange
  renameAccount: (id: string, name: string) => AccountChange
  removeAccount: (id: string) => AccountChange
  activateAccount: (id: string) => AccountChange
  hasCredentials: () => boolean
  /**
   * Carries a lone stored pair over into a book, once, at startup. Erases nothing it has not
   * read: a locked keychain leaves everything exactly where it is.
   */
  settleAccounts: () => void
  /** Main process only. Never expose over IPC — see spec § 4, invariant 1. */
  readCredentials: () => Credentials | null
  /**
   * The credentials behind an `accountFingerprint`, or `null` if that key is no longer held.
   * Main process only. What lets a job outliving a session be polled on the account that paid
   * for it — by the key rather than by the book entry, which a remove-and-re-add renews.
   */
  credentialsOf: (fingerprint: string) => Credentials | null
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

/**
 * Whether the calls now go out under a different key. Read off the credentials rather than off
 * the active id, because the two stopped being the same question: the development account keeps
 * one id while the file behind it may hold another key, and a cache kept across that change
 * would serve one project's contents under another's name.
 */
function movedKey(before: AccountBook, after: AccountBook): boolean {
  const from = activeCredentials(before)
  const to = activeCredentials(after)
  return from?.key !== to?.key || from?.secret !== to?.secret
}

function merge(base: Settings, partial: PartialSettings): Settings {
  return {
    general: { ...base.general, ...partial.general },
    home: { ...base.home, ...partial.home },
    workspaces: { ...base.workspaces, ...partial.workspaces },
    appearance: { ...base.appearance, ...partial.appearance },
    generation: { ...base.generation, ...partial.generation },
    storage: { ...base.storage, ...partial.storage },
    three: { ...base.three, ...partial.three },
    shortcuts: { ...base.shortcuts, ...partial.shortcuts },
    media: { ...base.media, ...partial.media },
    advanced: { ...base.advanced, ...partial.advanced },
    dictation: { ...base.dictation, ...partial.dictation },
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
  /**
   * The account `secrets/.env` stands for in development, read afresh each time: the file is
   * the truth about it, and nothing here ever writes it back.
   */
  environmentAccount?: () => StoredAccount | null
}

export function createSettingsStore(
  adapter: PersistenceAdapter,
  {
    onChange,
    newAccountId = () => `account_${randomUUID()}`,
    environmentAccount = () => null,
  }: SettingsStoreOptions = {},
): SettingsStore {
  const read = (): Settings =>
    merge(DEFAULT_SETTINGS, salvagePartialSettings(adapter.read(SETTINGS_KEY)))

  const readRaw = (key: string): string | null => adapter.read<string>(key) ?? null

  /** The plain text behind a stored blob, or null when the keychain would not hand it back. */
  const decrypted = (raw: string): string | null => {
    try {
      return adapter.decrypt(raw)
    } catch {
      return null
    }
  }

  const decrypt = <T>(raw: string, parse: (plain: string) => T | null): T | null => {
    const plain = decrypted(raw)
    if (plain === null) return null
    try {
      return parse(plain)
    } catch {
      // Truncated JSON, or a shape from another version.
      return null
    }
  }

  /**
   * Three states, not two, and the difference decides whether writing is allowed.
   *
   * `locked` — the keychain refused. The keys are still in there; the next launch will very
   * likely read them, so nothing may be written over them and nothing may be erased.
   * `corrupt` — decrypted fine, holds no book. The content is unrecoverable whatever we do, so
   * writing over it is the only way out; refusing would wedge account management for good.
   */
  type StoredBook =
    | { held: 'none' }
    | { held: 'locked' }
    | { held: 'corrupt' }
    | { held: 'book'; book: AccountBook }

  const storedBook = (): StoredBook => {
    const raw = readRaw(ACCOUNTS_KEY)
    if (!raw) return { held: 'none' }

    const plain = decrypted(raw)
    if (plain === null) return { held: 'locked' }

    try {
      const book = parseStoredAccounts(plain)
      return book ? { held: 'book', book } : { held: 'corrupt' }
    } catch {
      return { held: 'corrupt' }
    }
  }

  /**
   * Reads without side effects. A book that cannot be read reads as empty so the screens ask
   * for a key rather than claim to be set up — never as a reason to erase it.
   *
   * With no book at all, a lone pair from a single-credential install stands in for one, so
   * an upgrade keeps working before `settleAccounts` has had a chance to carry it over.
   */
  const persistedBook = (): AccountBook => {
    const stored = storedBook()
    if (stored.held === 'book') return stored.book
    if (stored.held !== 'none') return EMPTY_BOOK

    const lone = readRaw(CREDENTIALS_KEY)
    const credentials = lone && decrypt(lone, parseStoredCredentials)
    return credentials ? bookFromCredentials(credentials, MIGRATED_ACCOUNT_ID) : EMPTY_BOOK
  }

  /**
   * What the studio runs on: the keychain's accounts, plus the development one behind them,
   * repaired once the list is whole. The repair comes last on purpose — a stored `activeId` may
   * name the account that lives in a file, and judged against the blob alone it names nothing.
   *
   * Takes the persisted book so a caller holding one already need not read it twice.
   */
  const readBook = (persisted = persistedBook()): AccountBook =>
    settleBook(withEnvironment(persisted, environmentAccount()))

  /** Only what the keychain owns: the development account is read back from its file. */
  const writeBook = (book: AccountBook): void => {
    adapter.write(ACCOUNTS_KEY, adapter.encrypt(JSON.stringify(withoutEnvironment(book))))
  }

  /** Runs one change and reports whether it moved the active key — never guessed by a caller. */
  const apply = (change: (book: AccountBook) => AccountBook): AccountChange => {
    const stored = storedBook()

    /*
     * A write replaces the blob whole. Adding an account on top of keys we cannot see would
     * leave a book of one where the user had several — and the screen invites exactly that,
     * since an unreadable book reads as "no account yet". Only a locked keychain earns the
     * refusal: its keys are intact and the next launch reads them fine. Corrupt content has
     * nothing left to protect, and refusing there would lock the user out permanently.
     */
    if (stored.held === 'locked') throw new AccountError('store-unreadable')

    const before = readBook(stored.held === 'book' ? stored.book : undefined)
    const after = change(before)
    writeBook(after)

    return { accounts: summariesOf(after), credentialsChanged: movedKey(before, after) }
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

    keyedAccounts: () =>
      readBook().accounts.map(account => ({
        id: account.id,
        name: account.name,
        credentials: account.credentials,
      })),

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
      if (stored.held === 'locked') return

      const lone = readRaw(CREDENTIALS_KEY)
      // Read before erasing, always. A pair that will not decrypt today is still the only copy
      // of that key, and the launch that reads it may be the next one.
      const credentials = lone && decrypt(lone, parseStoredCredentials)

      if (stored.held === 'book') {
        // The book supersedes it, and left behind it would outlive "remove every account".
        if (credentials) adapter.remove(CREDENTIALS_KEY)
        return
      }

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

    credentialsOf: fingerprint => credentialsByFingerprint(readBook(), fingerprint),

    path: adapter.path,
  }
}

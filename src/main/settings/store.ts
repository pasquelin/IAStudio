import { DEFAULT_SETTINGS, type PartialSettings, type Settings } from '@shared/domain/settings'
import { parseStoredCredentials, salvagePartialSettings } from './validation'

export type Credentials = {
  key: string
  secret: string
}

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

export type SettingsStore = {
  read: () => Settings
  write: (partial: PartialSettings) => Settings
  setCredentials: (credentials: Credentials) => void
  forgetCredentials: () => void
  hasCredentials: () => boolean
  discardUnreadableCredentials: () => void
  /** Main process only. Never expose over IPC — see spec § 4, invariant 1. */
  readCredentials: () => Credentials | null
  /** Where the settings are written. */
  path: () => string
}

const SETTINGS_KEY = 'settings'
const CREDENTIALS_KEY = 'credentials'

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
}

export function createSettingsStore(
  adapter: PersistenceAdapter,
  { onChange }: SettingsStoreOptions = {},
): SettingsStore {
  const read = (): Settings =>
    merge(DEFAULT_SETTINGS, salvagePartialSettings(adapter.read(SETTINGS_KEY)))

  /**
   * Reads without side effects. Unreadable credentials are reported, not deleted: erasing
   * from a predicate would make `hasCredentials()` destructive, and a transient keychain
   * failure would silently cost the user their key.
   */
  const readCredentials = (): Credentials | null => {
    const encrypted = adapter.read<string>(CREDENTIALS_KEY)
    if (!encrypted) return null
    try {
      return parseStoredCredentials(adapter.decrypt(encrypted))
    } catch {
      // Keychain changed, profile migrated, data corrupted.
      return null
    }
  }

  return {
    read,

    write: partial => {
      const merged = merge(read(), partial)
      adapter.write(SETTINGS_KEY, merged)
      onChange?.(merged)
      return merged
    },

    setCredentials: credentials => {
      adapter.write(CREDENTIALS_KEY, adapter.encrypt(JSON.stringify(credentials)))
    },

    forgetCredentials: () => adapter.remove(CREDENTIALS_KEY),

    hasCredentials: () => readCredentials() !== null,

    /** Drops a stored blob that can no longer be read, so the user is asked again. */
    discardUnreadableCredentials: () => {
      if (adapter.read<string>(CREDENTIALS_KEY) && readCredentials() === null) {
        adapter.remove(CREDENTIALS_KEY)
      }
    },

    readCredentials,

    path: adapter.path,
  }
}

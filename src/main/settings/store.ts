import { DEFAULT_SETTINGS, type PartialSettings, type Settings } from '@shared/domain/settings'

export type Credentials = {
  key: string
  secret: string
}

/**
 * Ce dont le store a besoin pour persister. Injecté pour que les tests n'aient ni Electron
 * ni disque : `safeStorage` n'existe pas hors d'une application empaquetée.
 */
export type PersistenceAdapter = {
  read: <T>(key: string) => T | undefined
  write: (key: string, value: unknown) => void
  remove: (key: string) => void
  encrypt: (plain: string) => string
  decrypt: (encrypted: string) => string
}

export type SettingsStore = {
  read: () => Settings
  write: (partial: PartialSettings) => Settings
  setCredentials: (credentials: Credentials) => void
  forgetCredentials: () => void
  hasCredentials: () => boolean
  /** Réservé au main. Ne jamais exposer par IPC — cf. spec § 4, invariant 1. */
  readCredentials: () => Credentials | null
}

const SETTINGS_KEY = 'settings'
const CREDENTIALS_KEY = 'credentials'

function merge(base: Settings, partial: PartialSettings): Settings {
  return {
    appearance: { ...base.appearance, ...partial.appearance },
    generation: { ...base.generation, ...partial.generation },
    storage: { ...base.storage, ...partial.storage },
  }
}

function parseCredentials(plain: string): Credentials | null {
  const parsed: unknown = JSON.parse(plain)
  if (
    typeof parsed === 'object' &&
    parsed !== null &&
    'key' in parsed &&
    'secret' in parsed &&
    typeof parsed.key === 'string' &&
    typeof parsed.secret === 'string'
  ) {
    return { key: parsed.key, secret: parsed.secret }
  }
  return null
}

export function createSettingsStore(adapter: PersistenceAdapter): SettingsStore {
  const read = (): Settings => {
    const stored = adapter.read<PartialSettings>(SETTINGS_KEY)
    return stored ? merge(DEFAULT_SETTINGS, stored) : DEFAULT_SETTINGS
  }

  const readCredentials = (): Credentials | null => {
    const encrypted = adapter.read<string>(CREDENTIALS_KEY)
    if (!encrypted) return null
    try {
      return parseCredentials(adapter.decrypt(encrypted))
    } catch {
      // Trousseau changé, profil migré, données corrompues : on oublie plutôt que de
      // planter au démarrage. L'utilisateur ressaisira ses identifiants.
      adapter.remove(CREDENTIALS_KEY)
      return null
    }
  }

  return {
    read,

    write: partial => {
      const merged = merge(read(), partial)
      adapter.write(SETTINGS_KEY, merged)
      return merged
    },

    setCredentials: credentials => {
      adapter.write(CREDENTIALS_KEY, adapter.encrypt(JSON.stringify(credentials)))
    },

    forgetCredentials: () => adapter.remove(CREDENTIALS_KEY),

    hasCredentials: () => readCredentials() !== null,

    readCredentials,
  }
}

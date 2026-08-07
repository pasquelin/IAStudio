import { safeStorage } from 'electron'
import ElectronStore from 'electron-store'
import type { PersistenceAdapter } from './store'

/**
 * Backs the settings store with the user's config file and the OS keychain.
 *
 * `safeStorage` yields bytes; base64 keeps the adapter's contract a plain string, which is
 * what a JSON config file can hold.
 */
export function createElectronAdapter(): PersistenceAdapter {
  const store = new ElectronStore<Record<string, unknown>>({ name: 'settings' })

  return {
    // The config file is untyped by nature; callers validate what they read.
    read: <T>(key: string) => store.get(key) as T | undefined,

    write: (key, value) => store.set(key, value),

    remove: key => store.delete(key),

    path: () => store.path,

    encrypt: plain => {
      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error('OS encryption is unavailable: refusing to store credentials in clear')
      }
      return safeStorage.encryptString(plain).toString('base64')
    },

    decrypt: encrypted => safeStorage.decryptString(Buffer.from(encrypted, 'base64')),
  }
}

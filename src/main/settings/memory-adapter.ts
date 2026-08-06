import type { PersistenceAdapter } from './store'

export type MemoryAdapter = PersistenceAdapter & { raw: Map<string, unknown> }

/**
 * Persistence backed by a map, for tests: `safeStorage` does not exist outside a packaged
 * application, and `electron-store` writes to the real user profile.
 */
export function memoryAdapter(): MemoryAdapter {
  const raw = new Map<string, unknown>()

  return {
    raw,
    // A key-value store is untyped by nature; callers validate what they read.
    read: <T>(key: string) => raw.get(key) as T | undefined,
    write: (key, value) => void raw.set(key, value),
    remove: key => void raw.delete(key),
    encrypt: plain => `enc:${plain}`,
    decrypt: encrypted => {
      if (!encrypted.startsWith('enc:')) throw new Error('unreadable')
      return encrypted.slice(4)
    },
  }
}

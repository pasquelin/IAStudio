import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { createSettingsStore, type PersistenceAdapter } from './store'

function memoryAdapter(): PersistenceAdapter & { raw: Map<string, unknown> } {
  const raw = new Map<string, unknown>()
  return {
    raw,
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

describe('settings store', () => {
  let adapter: ReturnType<typeof memoryAdapter>

  beforeEach(() => {
    adapter = memoryAdapter()
  })

  it('returns the defaults when nothing is stored', () => {
    expect(createSettingsStore(adapter).read()).toEqual(DEFAULT_SETTINGS)
  })

  it('merges a partial write section by section', () => {
    const store = createSettingsStore(adapter)
    store.write({ appearance: { density: 'compact' } })

    const settings = store.read()
    expect(settings.appearance.density).toBe('compact')
    expect(settings.appearance.theme).toBe(DEFAULT_SETTINGS.appearance.theme)
    expect(settings.generation).toEqual(DEFAULT_SETTINGS.generation)
  })

  it('never exposes credentials through the settings it returns', () => {
    const store = createSettingsStore(adapter)
    store.setCredentials({ key: 'api_k', secret: 's3cr3t' })
    expect(JSON.stringify(store.read())).not.toContain('s3cr3t')
  })

  it('stores credentials encrypted, never in clear', () => {
    createSettingsStore(adapter).setCredentials({ key: 'api_k', secret: 's3cr3t' })
    expect(String(adapter.raw.get('credentials'))).toBe('enc:{"key":"api_k","secret":"s3cr3t"}')
  })

  it('reads back what it stored', () => {
    const store = createSettingsStore(adapter)
    store.setCredentials({ key: 'api_k', secret: 's3cr3t' })
    expect(store.readCredentials()).toEqual({ key: 'api_k', secret: 's3cr3t' })
    expect(store.hasCredentials()).toBe(true)
  })

  it('reports unreadable credentials without deleting them', () => {
    adapter.raw.set('credentials', 'garbage')
    const store = createSettingsStore(adapter)

    expect(store.hasCredentials()).toBe(false)
    // A transient keychain failure must not cost the user their key.
    expect(adapter.raw.has('credentials')).toBe(true)
  })

  it('drops an unreadable blob only when asked explicitly', () => {
    adapter.raw.set('credentials', 'garbage')
    const store = createSettingsStore(adapter)
    store.discardUnreadableCredentials()
    expect(adapter.raw.has('credentials')).toBe(false)
  })

  it('rejects a decryptable blob of the wrong shape', () => {
    adapter.raw.set('credentials', 'enc:{"key":"only"}')
    expect(createSettingsStore(adapter).readCredentials()).toBeNull()
  })

  it('forgets credentials on demand', () => {
    const store = createSettingsStore(adapter)
    store.setCredentials({ key: 'api_k', secret: 's3cr3t' })
    store.forgetCredentials()
    expect(store.hasCredentials()).toBe(false)
  })
})

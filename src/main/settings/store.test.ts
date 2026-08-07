import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { memoryAdapter, type MemoryAdapter } from './memory-adapter'
import { createSettingsStore } from './store'

describe('settings store', () => {
  let adapter: MemoryAdapter

  beforeEach(() => {
    adapter = memoryAdapter()
  })

  it('returns the defaults when nothing is stored', () => {
    expect(createSettingsStore(adapter).read()).toEqual(DEFAULT_SETTINGS)
  })

  it('falls back to the defaults when the stored settings are unusable', () => {
    adapter.raw.set('settings', { appearance: { theme: 'purple' } })
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

  it('reads a blank pair as unconfigured, and discards it', () => {
    adapter.raw.set('credentials', 'enc:{"key":"","secret":""}')
    const store = createSettingsStore(adapter)

    expect(store.readCredentials()).toBeNull()
    expect(store.hasCredentials()).toBe(false)

    store.discardUnreadableCredentials()
    expect(adapter.raw.has('credentials')).toBe(false)
  })

  it('trims a stored pair, as the input path does', () => {
    adapter.raw.set('credentials', 'enc:{"key":"api_k\\n","secret":" s3cr3t "}')
    expect(createSettingsStore(adapter).readCredentials()).toEqual({
      key: 'api_k',
      secret: 's3cr3t',
    })
  })

  it('forgets credentials on demand', () => {
    const store = createSettingsStore(adapter)
    store.setCredentials({ key: 'api_k', secret: 's3cr3t' })
    store.forgetCredentials()
    expect(store.hasCredentials()).toBe(false)
  })
})

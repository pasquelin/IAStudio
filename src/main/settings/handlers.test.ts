import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS, type AuthState } from '@shared/domain/settings'
import { CHANNELS } from '@shared/ipc'
import { invoke, resetHandlers } from '@main/ipc/test-harness'
import { registerSettingsHandlers } from './handlers'
import { memoryAdapter } from './memory-adapter'
import { createSettingsStore, type SettingsStore } from './store'

vi.mock('electron', async () => (await import('@main/ipc/test-harness')).mockElectron())

describe('settings handlers', () => {
  let settings: SettingsStore
  let onCredentialsChanged: () => void
  let authState: () => Promise<AuthState>

  beforeEach(() => {
    resetHandlers()
    settings = createSettingsStore(memoryAdapter())
    onCredentialsChanged = vi.fn()
    authState = vi.fn((): Promise<AuthState> => Promise.resolve({ authenticated: true }))
    registerSettingsHandlers({ settings, onCredentialsChanged, authState })
  })

  it('answers a read with the current settings', () => {
    expect(invoke(CHANNELS.settingsRead)).toEqual(DEFAULT_SETTINGS)
  })

  it('persists a valid write and answers with the merged settings', () => {
    expect(invoke(CHANNELS.settingsWrite, { appearance: { density: 'compact' } })).toMatchObject({
      appearance: { density: 'compact', theme: DEFAULT_SETTINGS.appearance.theme },
    })
    expect(settings.read().appearance.density).toBe('compact')
  })

  // The channel is typed, but the type is gone at runtime and the sender is a renderer.
  it('rejects a malformed write without persisting anything', () => {
    expect(() => invoke(CHANNELS.settingsWrite, { generation: { concurrentJobs: 999 } })).toThrow()
    expect(settings.read().generation).toEqual(DEFAULT_SETTINGS.generation)
  })

  it('stores credentials, drops the cached client, then reports the authentication', async () => {
    await expect(invoke(CHANNELS.settingsSetCredentials, '  api_k\n', 's3cr3t')).resolves.toEqual({
      authenticated: true,
    })

    expect(settings.readCredentials()).toEqual({ key: 'api_k', secret: 's3cr3t' })
    expect(onCredentialsChanged).toHaveBeenCalledOnce()
  })

  it('reports a failure instead of an authentication when nothing could be stored', async () => {
    await expect(invoke(CHANNELS.settingsSetCredentials, '', 's3cr3t')).resolves.toEqual({
      authenticated: false,
      reason: 'unexpected',
    })

    expect(settings.hasCredentials()).toBe(false)
    expect(onCredentialsChanged).not.toHaveBeenCalled()
    expect(authState).not.toHaveBeenCalled()
  })

  it('answers the auth state without touching the store', async () => {
    await expect(invoke(CHANNELS.settingsAuthState)).resolves.toEqual({ authenticated: true })
  })

  it('forgets credentials and announces the change', () => {
    settings.setCredentials({ key: 'api_k', secret: 's3cr3t' })
    invoke(CHANNELS.settingsForgetCredentials)

    expect(settings.hasCredentials()).toBe(false)
    expect(onCredentialsChanged).toHaveBeenCalledOnce()
  })
})

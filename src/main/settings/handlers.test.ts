import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS, type AuthState, type SettingsSectionId } from '@shared/domain/settings'
import type { SettingActionId } from '@shared/domain/settings-registry'
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
  let openSettings: (section: SettingsSectionId) => void
  let runAction: (id: SettingActionId) => void

  beforeEach(() => {
    resetHandlers()
    settings = createSettingsStore(memoryAdapter())
    onCredentialsChanged = vi.fn()
    authState = vi.fn((): Promise<AuthState> => Promise.resolve({ authenticated: true }))
    openSettings = vi.fn()
    runAction = vi.fn()
    registerSettingsHandlers({
      settings,
      onCredentialsChanged,
      authState,
      openSettings,
      runAction,
    })
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

  it('opens the settings window on the requested section', () => {
    invoke(CHANNELS.settingsOpen, 'account')
    expect(openSettings).toHaveBeenCalledWith('account')
  })

  /**
   * `openSettingsWindow` answers with the window it opened, and a `BrowserWindow` cannot be
   * cloned across the boundary: handing it back rejected the call with "an object could not be
   * cloned" while the window itself opened fine. The harness clones nothing, so the contract is
   * pinned on the return value instead.
   */
  it('answers nothing, whatever the opener hands back', () => {
    openSettings = vi.fn(() => ({ unclonable: () => {} }))
    resetHandlers()
    registerSettingsHandlers({
      settings,
      onCredentialsChanged,
      authState,
      openSettings,
      runAction,
    })

    expect(invoke(CHANNELS.settingsOpen, 'account')).toBeUndefined()
  })

  // The section ends up in the fragment the settings window loads, so it is never trusted.
  it('refuses to open a section it does not know', () => {
    expect(() => invoke(CHANNELS.settingsOpen, '../elsewhere')).toThrow()
    expect(openSettings).not.toHaveBeenCalled()
  })

  it('forgets credentials and announces the change', () => {
    settings.setCredentials({ key: 'api_k', secret: 's3cr3t' })
    invoke(CHANNELS.settingsForgetCredentials)

    expect(settings.hasCredentials()).toBe(false)
    expect(onCredentialsChanged).toHaveBeenCalledOnce()
  })
})

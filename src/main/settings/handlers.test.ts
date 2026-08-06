import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { CHANNELS } from '@shared/ipc'
import { registerSettingsHandlers } from './handlers'
import { memoryAdapter } from './memory-adapter'
import { createSettingsStore, type SettingsStore } from './store'

type Invoke = (...args: unknown[]) => unknown

const { registered } = vi.hoisted(() => ({ registered: new Map<string, Invoke>() }))

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: Invoke) => void registered.set(channel, handler),
  },
}))

function invoke(channel: string, ...args: unknown[]): unknown {
  const handler = registered.get(channel)
  if (!handler) throw new Error(`no handler registered for ${channel}`)
  return handler({}, ...args)
}

describe('settings handlers', () => {
  let settings: SettingsStore
  let onCredentialsChanged: () => void

  beforeEach(() => {
    registered.clear()
    settings = createSettingsStore(memoryAdapter())
    onCredentialsChanged = vi.fn()
    registerSettingsHandlers({ settings, onCredentialsChanged })
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

  it('forgets credentials and announces the change', () => {
    settings.setCredentials({ key: 'api_k', secret: 's3cr3t' })
    invoke(CHANNELS.settingsForgetCredentials)

    expect(settings.hasCredentials()).toBe(false)
    expect(onCredentialsChanged).toHaveBeenCalledOnce()
  })
})

import { vi } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import type { StudioBridge } from '@shared/ipc'

const noSubscription = (): (() => void) => () => {}

/**
 * A complete `window.studio`, for renderer tests. Complete rather than partial on purpose:
 * a component that reaches for a channel the test forgot to stub must fail on what it
 * received, not on `undefined is not a function`.
 */
export function installFakeBridge(settings: Partial<StudioBridge['settings']> = {}): StudioBridge {
  const bridge: StudioBridge = {
    settings: {
      read: () => Promise.resolve(DEFAULT_SETTINGS),
      write: () => Promise.resolve(DEFAULT_SETTINGS),
      setCredentials: () => Promise.resolve({ authenticated: true }),
      authState: () => Promise.resolve({ authenticated: false, reason: 'missing' }),
      forgetCredentials: () => Promise.resolve(),
      ...settings,
    },
    scenario: {
      listModels: () => Promise.resolve([]),
      describeModel: () => Promise.reject(new Error('no model')),
      generate: () => Promise.reject(new Error('no generation')),
      cancelJob: () => Promise.resolve(),
      listJobs: () => Promise.resolve([]),
      onProgress: noSubscription,
    },
    project: {
      create: () => Promise.reject(new Error('no project')),
      open: () => Promise.reject(new Error('no project')),
      current: () => Promise.resolve(null),
      pickFolder: () => Promise.resolve(null),
      onChange: noSubscription,
    },
    assets: {
      search: () => Promise.resolve([]),
      url: () => Promise.resolve(null),
    },
    window: {
      toggleFullScreen: () => Promise.resolve(),
      state: () => Promise.resolve({ active: true, fullScreen: false, maximized: false }),
      onState: noSubscription,
    },
    menu: {
      onOpenTool: noSubscription,
      onCommand: noSubscription,
    },
  }

  vi.stubGlobal('studio', bridge)
  return bridge
}

import { vi } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import type { StudioBridge } from '@shared/ipc'

const noSubscription = (): (() => void) => () => {}

/**
 * A complete `window.studio`, for renderer tests. Complete rather than partial on purpose:
 * a component that reaches for a channel the test forgot to stub must fail on what it
 * received, not on `undefined is not a function`.
 */
export type BridgeOverrides = { [K in keyof StudioBridge]?: Partial<StudioBridge[K]> }

export function installFakeBridge(overrides: BridgeOverrides = {}): StudioBridge {
  const bridge: StudioBridge = {
    settings: {
      read: () => Promise.resolve(DEFAULT_SETTINGS),
      write: () => Promise.resolve(DEFAULT_SETTINGS),
      setCredentials: () => Promise.resolve({ authenticated: true }),
      authState: () => Promise.resolve({ authenticated: false, reason: 'missing' }),
      forgetCredentials: () => Promise.resolve(),
      ...overrides.settings,
    },
    scenario: {
      searchModels: () => Promise.resolve({ items: [], cursor: null }),
      modelPreviews: () => Promise.resolve({}),
      describeModel: () => Promise.reject(new Error('no model')),
      generate: () => Promise.reject(new Error('no generation')),
      cancelJob: () => Promise.resolve(),
      listJobs: () => Promise.resolve([]),
      onProgress: noSubscription,
      ...overrides.scenario,
    },
    project: {
      create: () => Promise.reject(new Error('no project')),
      open: () => Promise.reject(new Error('no project')),
      current: () => Promise.resolve(null),
      pickFolder: () => Promise.resolve(null),
      onChange: noSubscription,
      ...overrides.project,
    },
    assets: {
      search: () => Promise.resolve([]),
      peaks: () => Promise.resolve(null),
      saveAudio: () => Promise.reject(new Error('no project')),
      ...overrides.assets,
    },
    window: {
      toggleFullScreen: () => Promise.resolve(),
      state: () => Promise.resolve({ active: true, fullScreen: false, maximized: false }),
      onState: noSubscription,
      setWorkspace: () => Promise.resolve(),
      ...overrides.window,
    },
    diagnostics: {
      onLog: noSubscription,
      ...overrides.diagnostics,
    },
    menu: {
      onOpenTool: noSubscription,
      onCommand: noSubscription,
      onSceneAdd: noSubscription,
      ...overrides.menu,
    },
  }

  vi.stubGlobal('studio', bridge)
  return bridge
}

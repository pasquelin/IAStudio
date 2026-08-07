import { create } from 'zustand'
import {
  DEFAULT_SETTINGS,
  type AuthState,
  type PartialSettings,
  type Settings,
} from '@shared/domain/settings'
import { partialFor, type SettingPath, type SettingValue } from '@shared/domain/settings-path'
import { getBridge } from '@/services/bridge'

const UNKNOWN_AUTH: AuthState = { authenticated: false, reason: 'missing' }

type SettingsState = {
  settings: Settings
  auth: AuthState
  /** False until the main process has answered once — the defaults are a placeholder. */
  loaded: boolean

  /** Loads the settings and follows the changes other windows make. Returns the unsubscribe. */
  connect: () => Promise<() => void>
  write: (partial: PartialSettings) => Promise<void>
  /** Writes one leaf. Nothing outside this store has to know how a path becomes a partial. */
  setValue: (path: SettingPath, value: SettingValue | undefined) => Promise<void>
  refreshAuth: () => Promise<AuthState>
  signIn: (key: string, secret: string) => Promise<AuthState>
  signOut: () => Promise<void>
}

/**
 * Renderer-side replica of the settings held by the main process. Credentials are absent by
 * construction: the only thing the renderer learns about them is whether they work.
 */
export const useSettings = create<SettingsState>()((set, get) => ({
  settings: DEFAULT_SETTINGS,
  auth: UNKNOWN_AUTH,
  loaded: false,

  connect: async () => {
    const bridge = getBridge()
    if (!bridge) return () => {}

    const stop = bridge.settings.onChange(settings => set({ settings }))

    const [settings, auth] = await Promise.all([
      bridge.settings.read(),
      bridge.settings.authState(),
    ])
    set({ settings, auth, loaded: true })
    return stop
  },

  write: async partial => {
    const bridge = getBridge()
    if (!bridge) return
    set({ settings: await bridge.settings.write(partial) })
  },

  setValue: async (path, value) => get().write(partialFor(path, value)),

  refreshAuth: async () => {
    const bridge = getBridge()
    if (!bridge) return get().auth

    const auth = await bridge.settings.authState()
    set({ auth })
    return auth
  },

  signIn: async (key, secret) => {
    const bridge = getBridge()
    if (!bridge) return get().auth

    const auth = await bridge.settings.setCredentials(key, secret)
    set({ auth })
    return auth
  },

  signOut: async () => {
    const bridge = getBridge()
    if (!bridge) return

    await bridge.settings.forgetCredentials()
    // Asking again rather than assuming `missing`: a development `.env` may still answer.
    set({ auth: await bridge.settings.authState() })
  },
}))

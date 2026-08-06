import { create } from 'zustand'
import {
  DEFAULT_SETTINGS,
  type AuthState,
  type PartialSettings,
  type Settings,
} from '@shared/domain/settings'
import { getBridge } from '@/services/bridge'

const UNKNOWN_AUTH: AuthState = { authenticated: false, reason: 'missing' }

type SettingsState = {
  settings: Settings
  auth: AuthState
  /** False until the main process has answered once — the defaults are a placeholder. */
  loaded: boolean
  accountDialogOpen: boolean

  load: () => Promise<void>
  write: (partial: PartialSettings) => Promise<void>
  refreshAuth: () => Promise<AuthState>
  signIn: (key: string, secret: string) => Promise<AuthState>
  signOut: () => Promise<void>
  openAccountDialog: () => void
  closeAccountDialog: () => void
}

/**
 * Renderer-side replica of the settings held by the main process. Credentials are absent by
 * construction: the only thing the renderer learns about them is whether they work.
 */
export const useSettings = create<SettingsState>()((set, get) => ({
  settings: DEFAULT_SETTINGS,
  auth: UNKNOWN_AUTH,
  loaded: false,
  accountDialogOpen: false,

  load: async () => {
    const bridge = getBridge()
    if (!bridge) return

    const [settings, auth] = await Promise.all([
      bridge.settings.read(),
      bridge.settings.authState(),
    ])
    set({ settings, auth, loaded: true })
  },

  write: async partial => {
    const bridge = getBridge()
    if (!bridge) return
    set({ settings: await bridge.settings.write(partial) })
  },

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

  openAccountDialog: () => set({ accountDialogOpen: true }),
  closeAccountDialog: () => set({ accountDialogOpen: false }),
}))

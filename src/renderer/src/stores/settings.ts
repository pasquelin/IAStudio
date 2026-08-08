import { create } from 'zustand'
import {
  DEFAULT_SETTINGS,
  type AuthState,
  type PartialSettings,
  type Settings,
  type SettingsSectionId,
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
  /** Opens the settings window on a section — how a panel leads to what it says is missing. */
  openSection: (section: SettingsSectionId) => void
}

/**
 * Renderer-side replica of the settings held by the main process. Credentials are absent by
 * construction: the only thing the renderer learns about them is whether they work.
 */
/**
 * The project the active key opens onto, or `null` while nothing has said which.
 *
 * Derived rather than stored: it comes from the library's own answers, and a badge that read a
 * copy would keep judging ownership against the previous key for as long as it went unrefreshed.
 */
export function activeOwnerId(state: Pick<SettingsState, 'auth'>): string | null {
  return state.auth.authenticated ? (state.auth.ownerId ?? null) : null
}

export const useSettings = create<SettingsState>()((set, get) => ({
  settings: DEFAULT_SETTINGS,
  auth: UNKNOWN_AUTH,
  loaded: false,

  connect: async () => {
    const bridge = getBridge()
    if (!bridge) return () => {}

    let pushed = false
    const stop = bridge.settings.onChange(settings => {
      pushed = true
      set({ settings })
    })

    try {
      const [settings, auth] = await Promise.all([
        bridge.settings.read(),
        bridge.settings.authState(),
      ])

      // A change landing while the read was in flight is newer than what the read answered:
      // applying the snapshot on top of it would put the window back one version.
      set({ auth, loaded: true, ...(pushed ? {} : { settings }) })
    } catch {
      // The defaults stay on screen, and the subscription still stands: throwing here would
      // strand the listener with nobody holding the way to remove it.
    }

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

  openSection: section => {
    void getBridge()?.settings.open(section)
  },
}))

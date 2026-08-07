import type { AuthState, SettingsSectionId } from '@shared/domain/settings'
import { CHANNELS } from '@shared/ipc'
import { handle } from '@main/ipc/handle'
import type { SettingsStore } from './store'
import { parseCredentials, parsePartialSettings, parseSettingsSection } from './validation'

export type SettingsHandlerDeps = {
  settings: SettingsStore
  /** Called whenever the stored credentials change, so a cached API client can be dropped. */
  onCredentialsChanged: () => void
  authState: () => Promise<AuthState>
  /** Opens the settings window on a section — a panel saying the key is missing leads here. */
  openSettings: (section: SettingsSectionId) => void
}

export function registerSettingsHandlers({
  settings,
  onCredentialsChanged,
  authState,
  openSettings,
}: SettingsHandlerDeps): void {
  handle(CHANNELS.settingsRead, () => settings.read())

  // The channel is typed `PartialSettings`, but TypeScript is gone at runtime and the sender
  // is a renderer: what arrives here is `unknown` until zod says otherwise.
  handle(CHANNELS.settingsWrite, (_event, partial) => settings.write(parsePartialSettings(partial)))

  handle(CHANNELS.settingsSetCredentials, async (_event, key, secret) => {
    try {
      settings.setCredentials(parseCredentials(key, secret))
    } catch {
      // Keychain unavailable, or an empty field. Either way nothing was stored, and the
      // dialog must say so rather than report an authentication that never happened.
      return { authenticated: false, reason: 'unexpected' }
    }

    onCredentialsChanged()
    return await authState()
  })

  handle(CHANNELS.settingsAuthState, () => authState())

  handle(CHANNELS.settingsForgetCredentials, () => {
    settings.forgetCredentials()
    onCredentialsChanged()
  })

  // A block, not an expression: `openSettingsWindow` answers with the `BrowserWindow` it
  // opened, and returning that from a handler hands an unclonable object to the IPC
  // serializer — the window would open and the call would still reject.
  handle(CHANNELS.settingsOpen, (_event, section) => {
    openSettings(parseSettingsSection(section))
  })
}

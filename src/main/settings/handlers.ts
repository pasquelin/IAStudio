import type { AuthState } from '@shared/domain/settings'
import { CHANNELS } from '@shared/ipc'
import { handle } from '@main/ipc/handle'
import type { SettingsStore } from './store'
import { parseCredentials, parsePartialSettings } from './validation'

export type SettingsHandlerDeps = {
  settings: SettingsStore
  /** Called whenever the stored credentials change, so a cached API client can be dropped. */
  onCredentialsChanged: () => void
  authState: () => Promise<AuthState>
}

export function registerSettingsHandlers({
  settings,
  onCredentialsChanged,
  authState,
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
}

import { CHANNELS } from '@shared/ipc'
import { handle } from '@main/ipc/handle'
import type { SettingsStore } from './store'
import { parsePartialSettings } from './validation'

export type SettingsHandlerDeps = {
  settings: SettingsStore
  /** Called whenever the stored credentials change, so a cached API client can be dropped. */
  onCredentialsChanged: () => void
}

export function registerSettingsHandlers({
  settings,
  onCredentialsChanged,
}: SettingsHandlerDeps): void {
  handle(CHANNELS.settingsRead, () => settings.read())

  // The channel is typed `PartialSettings`, but TypeScript is gone at runtime and the sender
  // is a renderer: what arrives here is `unknown` until zod says otherwise.
  handle(CHANNELS.settingsWrite, (_event, partial) => settings.write(parsePartialSettings(partial)))

  handle(CHANNELS.settingsForgetCredentials, () => {
    settings.forgetCredentials()
    onCredentialsChanged()
  })
}

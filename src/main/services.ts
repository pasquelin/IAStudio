import { app } from 'electron'
import type { AuthState } from '@shared/domain/settings'
import { createClientProvider, type ClientProvider } from './scenario/client'
import { createFileSystemFallback, resolveCredentials } from './scenario/credentials'
import { createElectronAdapter } from './settings/adapter'
import { createSettingsStore, type SettingsStore } from './settings/store'

export type Services = {
  settings: SettingsStore
  client: ClientProvider
  onCredentialsChanged: () => void
  authState: () => Promise<AuthState>
}

/**
 * Composition root of the main process. Everything stateful is built here, once, so no module
 * reaches for a singleton and every collaborator stays injectable in tests.
 */
export function createServices(): Services {
  const settings = createSettingsStore(createElectronAdapter())

  // A keychain the OS can no longer open leaves a blob that decrypts to nothing. Dropping it
  // at startup is what makes the account dialog ask again instead of claiming to be set up.
  settings.discardUnreadableCredentials()

  const fallback = createFileSystemFallback(app.getAppPath(), app.isPackaged)
  const client = createClientProvider(() => resolveCredentials(settings, fallback))

  return {
    settings,
    client,
    onCredentialsChanged: () => client.invalidate(),
    authState: () => client.authState(),
  }
}

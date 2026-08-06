import { app } from 'electron'
import type { AuthState } from '@shared/domain/settings'
import { createClientProvider, type ClientProvider } from './scenario/client'
import { catalogOf } from './scenario/catalog'
import { createFileSystemFallback, resolveCredentials } from './scenario/credentials'
import { createModelRegistry, type ModelRegistry } from './scenario/model-registry'
import { createElectronAdapter } from './settings/adapter'
import { createSettingsStore, type SettingsStore } from './settings/store'

export type Services = {
  settings: SettingsStore
  client: ClientProvider
  models: ModelRegistry
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
  const models = createModelRegistry({ catalog: () => catalogOf(client.require()) })

  return {
    settings,
    client,
    models,
    // Another key means another catalogue: keeping the cache would show the previous
    // account's models under the new one.
    onCredentialsChanged: () => {
      client.invalidate()
      models.invalidate()
    },
    authState: () => client.authState(),
  }
}

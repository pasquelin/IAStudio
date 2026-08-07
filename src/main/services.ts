import { app, BrowserWindow, dialog, net } from 'electron'
import { randomUUID } from 'node:crypto'
import type { AuthState } from '@shared/domain/settings'
import { EVENTS } from '@shared/ipc'
import { createAssetCollector } from './assets/collector'
import { assetFilePath, serveAssets } from './assets/protocol'
import { createLocalBackend, type LocalBackend } from './assets/local-backend'
import { broadcast } from './ipc/broadcast'
import { createJobManager, type JobManager } from './scenario/job-manager'
import { runnerOf } from './scenario/runner'
import { createProjectStore, type ProjectStore } from './project/store'
import { openNativeDatabase } from './project/sqlite-native'
import { catalogOf } from './scenario/model-catalog'
import { createClientProvider, type ClientProvider } from './scenario/client'
import { createFileSystemFallback, resolveCredentials } from './scenario/credentials'
import { createModelRegistry, type ModelRegistry } from './scenario/model-registry'
import { createElectronAdapter } from './settings/adapter'
import { createSettingsStore, type SettingsStore } from './settings/store'

export type Services = {
  settings: SettingsStore
  client: ClientProvider
  models: ModelRegistry
  jobs: JobManager
  project: ProjectStore
  assets: LocalBackend
  /** Minted here so the collector and the audio editor cannot name assets differently. */
  newAssetId: () => string
  pickFolder: () => Promise<string | null>
  onCredentialsChanged: () => void
  authState: () => Promise<AuthState>
}

const timestamp = (): string => new Date().toISOString()

const newAssetId = (): string => `asset_${randomUUID()}`

async function pickFolder(): Promise<string | null> {
  const parent = BrowserWindow.getFocusedWindow()
  const options: Electron.OpenDialogOptions = {
    properties: ['openDirectory', 'createDirectory'],
  }

  const result = parent
    ? await dialog.showOpenDialog(parent, options)
    : await dialog.showOpenDialog(options)

  return result.canceled ? null : (result.filePaths[0] ?? null)
}

/** `net.fetch` rather than the global one: it goes through Electron's own network stack. */
async function download(url: string): Promise<Uint8Array> {
  const response = await net.fetch(url)
  if (!response.ok) throw new Error(`asset download failed with status ${response.status}`)
  return new Uint8Array(await response.arrayBuffer())
}

/**
 * Composition root of the main process. Everything stateful is built here, once, so no module
 * reaches for a singleton and every collaborator stays injectable in tests.
 *
 * Called after `app.whenReady()`: it registers the asset protocol handler, which Electron
 * refuses before then.
 */
export function createServices(): Services {
  const settings = createSettingsStore(createElectronAdapter())

  // A keychain the OS can no longer open leaves a blob that decrypts to nothing. Dropping it
  // at startup is what makes the account dialog ask again instead of claiming to be set up.
  settings.discardUnreadableCredentials()

  const fallback = createFileSystemFallback(app.getAppPath(), app.isPackaged)
  const client = createClientProvider(() => resolveCredentials(settings, fallback))
  const models = createModelRegistry({ catalog: () => catalogOf(client.require()) })

  const project = createProjectStore({
    openDatabase: openNativeDatabase,
    now: timestamp,
    onChange: current => {
      if (current) settings.write({ storage: { lastProject: current.path } })
      broadcast(EVENTS.projectChanged, current)
    },
  })

  const assets = createLocalBackend({
    download,
    projectPath: () => project.path(),
    catalog: () => project.catalog(),
    now: timestamp,
  })

  const jobs = createJobManager({
    runner: runnerOf(() => client.require()),
    collect: createAssetCollector({
      retrieve: async remoteAssetId =>
        (await client.require().assets.retrieve(remoteAssetId)).asset,
      backend: assets,
      newId: newAssetId,
    }),
    concurrency: () => settings.read().generation.concurrentJobs,
    maxRetries: () => settings.read().generation.maxRetries,
    onProgress: progress => broadcast(EVENTS.jobProgress, progress),
    now: timestamp,
    newId: () => `job_${randomUUID()}`,
    sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),
  })

  serveAssets(assetId => {
    const current = project.current()
    if (!current) return null

    const asset = project.catalog().find(assetId)
    return asset?.path ? assetFilePath(current.path, asset.path) : null
  })

  const lastProject = settings.read().storage.lastProject
  // Best effort: the folder may have been moved or deleted since the last session, and that
  // is not a reason to refuse to start.
  if (lastProject) void project.open(lastProject).catch(() => {})

  return {
    settings,
    client,
    models,
    jobs,
    project,
    assets,
    newAssetId,
    pickFolder,
    // Another key means another catalogue: keeping the cache would show the previous
    // account's models under the new one.
    onCredentialsChanged: () => {
      client.invalidate()
      models.invalidate()
    },
    authState: () => client.authState(),
  }
}

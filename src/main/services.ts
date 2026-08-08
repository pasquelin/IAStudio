import { app, BrowserWindow, dialog, net, shell } from 'electron'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { availableParallelism } from 'node:os'
import { delimiter, dirname } from 'node:path'
import type { AccountSummary } from '@shared/domain/account'
import type { Asset, AssetType } from '@shared/domain/asset'
import type { MediaCapabilities } from '@shared/domain/media'
import type { PathKind } from '@shared/domain/settings-registry'
import type { AuthState } from '@shared/domain/settings'
import { log } from './log'
import { TRANSLATIONS, type Language } from '@shared/i18n'
import { effectiveLanguage } from '@shared/i18n/languages'
import { EVENTS } from '@shared/ipc'
import { isDevelopment } from '@main/environment'
import { createAssetCollector } from './assets/collector'
import { serveAssets, servedFileOf } from './assets/protocol'
import { createFfmpegResolver } from './media/ffmpeg'
import { bundledFfmpeg, resourcesRoot } from './resources'
import { linkedAsset, mediaFilters } from './media/link'
import {
  binaryRuns,
  companionPath,
  findOnPath,
  forgetBinaries,
  hashSource,
  probeSource,
  runProcess,
} from './media/runner'
import { openPeaksProcess } from './media/peaks-process'
import type { PeaksClient } from './media/peaks-client'
import { createMediaService, type MediaService } from './media/service'
import { createLocalBackend, type LocalBackend } from './assets/local-backend'
import { broadcast } from './ipc/broadcast'
import { setLogVerbosity } from './log'
import type Scenario from '@scenario-labs/sdk'
import {
  createJobManager,
  type AssetCollector,
  type JobAccount,
  type JobManager,
} from './scenario/job-manager'
import { runnerOf } from './scenario/runner'
import { createDocumentFiles, type DocumentFiles } from './project/documents'
import { createProjectStore, type ProjectStore } from './project/store'
import { openCatalogThread } from './project/catalog-thread'
import { catalogOf } from './scenario/model-catalog'
import { createAssetUploader, type AssetUploader } from './scenario/uploader'
import { createClientProvider, type ClientProvider } from './scenario/client'
import { createCredentialsWatch } from './scenario/credentials-watch'
import { createFileSystemFallback, environmentAccount } from './scenario/credentials'
import { createModelRegistry, type ModelRegistry } from './scenario/model-registry'
import { createElectronAdapter } from './settings/adapter'
import { createSettingsStore, type SettingsStore } from './settings/store'
import { buildMenu } from './menu'
import { setWindowLanguage } from './window/language'
import { applyTheme } from './window/theme'

export type Services = {
  settings: SettingsStore
  client: ClientProvider
  models: ModelRegistry
  jobs: JobManager
  uploads: AssetUploader
  project: ProjectStore
  documents: DocumentFiles
  assets: LocalBackend
  /** Minted here so the collector and the audio editor cannot name assets differently. */
  newAssetId: () => string
  media: MediaService
  /** Links a file into the open project — id, timestamp and catalogue row in one move. */
  link: (source: string, type: AssetType) => Promise<Asset>
  capabilities: () => Promise<MediaCapabilities>
  /** The language in force, machine locale included. Both the menu and the dialogs read it. */
  language: () => Language
  pickPath: (kind: PathKind) => Promise<string | null>
  /** Shows a file in the OS file manager, so the path never leaves this process. */
  reveal: (file: string) => void
  pickMedia: () => Promise<string[]>
  onCredentialsChanged: () => void
  authState: () => Promise<AuthState>
  broadcastAccounts: (accounts: AccountSummary[]) => void
}

const timestamp = (): string => new Date().toISOString()
const newAssetId = (): string => `asset_${randomUUID()}`

async function openDialog(options: Electron.OpenDialogOptions): Promise<string[]> {
  const parent = BrowserWindow.getFocusedWindow()
  const result = parent
    ? await dialog.showOpenDialog(parent, options)
    : await dialog.showOpenDialog(options)

  return result.canceled ? [] : result.filePaths
}

/**
 * One picker for every path the interface asks for. `createDirectory` on a folder because the
 * one being chosen often does not exist yet — where the projects will go.
 */
async function pickPath(kind: PathKind, startIn?: string): Promise<string | null> {
  const picked = await openDialog({
    properties: kind === 'folder' ? ['openDirectory', 'createDirectory'] : ['openFile'],
    // Absent is normal: the dialog then opens wherever the OS last left it.
    ...(startIn ? { defaultPath: startIn } : {}),
  })
  return picked[0] ?? null
}

/** Translated here, where the dialog opens: a native picker shows these names as they are. */
function pickMedia(language: Language): Promise<string[]> {
  const t = TRANSLATIONS[language].dialog
  const filters = mediaFilters({
    all: t.allMedia,
    video: t.video,
    audio: t.audio,
    image: t.image,
  })

  return openDialog({ properties: ['openFile', 'multiSelections'], filters })
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
 * refuses before then. The settings are built before it and handed in — see `createSettings`.
 */
/**
 * The settings, on their own and before anything else. Built apart from the rest because the
 * first window is painted from them: the splash takes its colour from the theme, and the rest
 * of `createServices` opens SQLite synchronously — far too late to decide what to paint.
 *
 * Notified from the store rather than from the IPC handler: the project store writes
 * `lastProject` on its own, and every window replicates these settings.
 */
export function createSettings(): SettingsStore {
  // `isDevelopment`, arrived on main: the fallback reads a `.env` only outside a packaged run.
  const fallback = createFileSystemFallback(app.getAppPath(), !isDevelopment)

  const settings = createSettingsStore(createElectronAdapter(), {
    // Read afresh on every account read, so editing the file is enough to change the account.
    environmentAccount: () => environmentAccount(fallback),
    onChange: current => {
      // Before the broadcast: the renderer reads `prefers-color-scheme` to resolve `system`,
      // and Chromium only answers with the new value once `themeSource` has moved.
      applyTheme(current.appearance.theme)
      setLogVerbosity(current.advanced.logLevel)
      // The native menu is built once and never re-reads anything: without this the window
      // changes language and the menu bar above it does not.
      const spoken = effectiveLanguage(current.general.language, app.getLocale())
      setWindowLanguage(spoken)
      buildMenu(spoken, current.shortcuts.overrides)
      broadcast(EVENTS.settingsChanged, current)
    },
  })

  const stored = settings.read()

  // Before any window is painted: one created on the OS preference and corrected afterwards
  // flashes the wrong colour for a frame — the splash did exactly that.
  applyTheme(stored.appearance.theme)
  setLogVerbosity(stored.advanced.logLevel)
  setWindowLanguage(effectiveLanguage(stored.general.language, app.getLocale()))

  // Carries a pre-multi-account install over to a book of one. Erases nothing it has not read:
  // a keychain the OS will not open this launch leaves every key exactly where it is.
  settings.settleAccounts()

  return settings
}

/**
 * Composition root of the main process. Everything stateful is built here, once, so no module
 * reaches for a singleton and every collaborator stays injectable in tests.
 */
export function createServices(settings: SettingsStore): Services {
  const language = (): Language =>
    effectiveLanguage(settings.read().general.language, app.getLocale())

  // Every cache the API fills belongs to one account. They subscribe where they are built, so
  // that a cache added later cannot be left out of a purge list nobody thinks to reread.
  const credentials = createCredentialsWatch()

  const client = createClientProvider(() => settings.readCredentials(), credentials.watch)
  const models = createModelRegistry({
    catalog: () => catalogOf(client.require()),
    watch: credentials.watch,
  })

  const project = createProjectStore({
    openCatalog: openCatalogThread,
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

  const documents = createDocumentFiles({
    projectPath: () => project.path(),
    now: timestamp,
  })

  const ffmpeg = createFfmpegResolver(() => ({
    bundled: bundledFfmpeg(resourcesRoot(), process.platform),
    configured: settings.read().media.ffmpegPath,
    // Last, and mostly for development, where the shipped binary is only there once
    // `pnpm ffmpeg:fetch` has run.
    onPath: findOnPath('ffmpeg', process.env.PATH, delimiter, existsSync),
    exists: existsSync,
  }))

  // Forked on the first sound imported, then kept: most sessions never import one at all, and
  // the ingest pool already bounds how many run at once. Forgotten when it exits, so a crash
  // costs the file being ingested and not the session.
  let peaks: PeaksClient | null = null

  const media = createMediaService({
    ffmpeg: ffmpeg.path,
    run: (binary, args, signal) => runProcess(binary, args, { signal }),
    probe: (source, signal) => probeSource(companionPath(ffmpeg.path()), source, { signal }),
    hash: hashSource,
    computePeaks: run =>
      (peaks ??= openPeaksProcess(() => {
        peaks = null
      })).compute(run),
    duplicateExists: async (assetId, hash) => {
      const existing = await project.catalog().findByHash(hash)
      return existing !== null && existing.id !== assetId
    },
    discard: async assetId => {
      await project.catalog().remove(assetId)
    },
    save: async (assetId, fields) => {
      const catalog = project.catalog()
      const current = await catalog.find(assetId)
      // The row may have been deleted while a twenty-minute proxy was encoding.
      if (current) await catalog.add({ ...current, ...fields })
    },
    writeFile: async (path, data) => {
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, data)
    },
    onProgress: progress => broadcast(EVENTS.mediaProgress, progress),
    projectPath: () => project.current()?.path ?? null,
    // Two cores left to the interface and to whatever else the machine is doing.
    concurrency: () => Math.max(1, availableParallelism() - 2),
  })

  const collectorOf = (scenario: Scenario): AssetCollector =>
    createAssetCollector({
      retrieve: async remoteAssetId => {
        const { asset } = await scenario.assets.retrieve(remoteAssetId)
        return { ...asset, metadataType: asset.metadata.type, parentId: asset.metadata.parentId }
      },
      backend: assets,
      newId: newAssetId,
      localIdOf: async remoteAssetId =>
        (await project.catalog().findByRemoteId(remoteAssetId))?.id ?? null,
    })

  // Rebuilt only when the client is, so every job of one account shares a single graph rather
  // than allocating its own — what matters is that a job holds ONE binding, not a fresh one.
  let bound: { scenario: Scenario; account: JobAccount } | null = null

  const uploads = createAssetUploader(() => client.require().assets)

  const jobs = createJobManager({
    // Read once per job and kept, so a switch mid-flight does not have the new key asked about
    // the previous account's job id — see `JobAccount`.
    account: () => {
      const scenario = client.get()
      if (!scenario) return null

      if (bound?.scenario !== scenario) {
        bound = {
          scenario,
          account: { runner: runnerOf(scenario), collect: collectorOf(scenario) },
        }
      }

      return bound.account
    },
    concurrency: () => settings.read().generation.concurrentJobs,
    maxRetries: () => settings.read().generation.maxRetries,
    onProgress: progress => broadcast(EVENTS.jobProgress, progress),
    now: timestamp,
    newId: () => `job_${randomUUID()}`,
    sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),
  })

  serveAssets(async assetId => {
    const current = project.current()
    if (!current) return null

    const asset = await project.catalog().find(assetId)
    return asset ? servedFileOf(current.path, asset) : null
  })

  const stored = settings.read()
  const lastProject = stored.general.startup === 'lastProject' ? stored.storage.lastProject : null
  // Best effort: the folder may have been moved or deleted since the last session, and that
  // is not a reason to refuse to start. Said out loud all the same — swallowed, a catalogue
  // that fails to open leaves every panel claiming no project is open while the folder is
  // plainly still there, and nothing anywhere says why.
  if (lastProject) {
    void project.open(lastProject).catch((error: unknown) => {
      log.warn('project', `reopening ${lastProject} failed: ${String(error)}`)
    })
  }

  return {
    settings,
    client,
    models,
    jobs,
    uploads,
    project,
    documents,
    assets,
    newAssetId,
    media,
    link: async (source, type) =>
      await project
        .catalog()
        .add(linkedAsset(source, { id: newAssetId(), type, now: timestamp() })),
    // Asked, not cached: this is what the settings pane consults after the user installed the
    // binary it just said was missing. Run rather than looked for — a half-written download and
    // a binary built for the other architecture both exist on disk and encode nothing.
    capabilities: async () => {
      ffmpeg.invalidate()
      forgetBinaries()
      return { ffmpeg: await binaryRuns(ffmpeg.path()) }
    },
    language,
    pickPath,
    reveal: file => shell.showItemInFolder(file),
    pickMedia: () => pickMedia(language()),
    // Another key means another catalogue: keeping a cache would show the previous account's
    // contents under the new one.
    onCredentialsChanged: credentials.changed,
    authState: () => client.authState(),
    // Every window carries the switch, not just the one that made it: the studio and the
    // settings window both show which account is active.
    broadcastAccounts: accounts => broadcast(EVENTS.accountsChanged, accounts),
  }
}

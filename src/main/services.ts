import { app, BrowserWindow, dialog, net, shell } from 'electron'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { availableParallelism } from 'node:os'
import { delimiter, dirname } from 'node:path'
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
import { createMediaService, type MediaService } from './media/service'
import { createLocalBackend, type LocalBackend } from './assets/local-backend'
import { broadcast } from './ipc/broadcast'
import { setLogVerbosity } from './log'
import { createJobManager, type JobManager } from './scenario/job-manager'
import { runnerOf } from './scenario/runner'
import { createDocumentFiles, type DocumentFiles } from './project/documents'
import { createProjectStore, type ProjectStore } from './project/store'
import { openCatalogThread } from './project/catalog-thread'
import { catalogOf } from './scenario/model-catalog'
import { createClientProvider, type ClientProvider } from './scenario/client'
import { createFileSystemFallback, resolveCredentials } from './scenario/credentials'
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
  const settings = createSettingsStore(createElectronAdapter(), {
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

  // A keychain the OS can no longer open leaves a blob that decrypts to nothing. Dropping it
  // at startup is what makes the account dialog ask again instead of claiming to be set up.
  settings.discardUnreadableCredentials()

  return settings
}

/**
 * Composition root of the main process. Everything stateful is built here, once, so no module
 * reaches for a singleton and every collaborator stays injectable in tests.
 */
export function createServices(settings: SettingsStore): Services {
  const language = (): Language =>
    effectiveLanguage(settings.read().general.language, app.getLocale())

  // `isDevelopment`, arrived on main: the fallback reads a `.env` only outside a packaged run.
  const fallback = createFileSystemFallback(app.getAppPath(), !isDevelopment)
  const client = createClientProvider(() => resolveCredentials(settings, fallback))
  const models = createModelRegistry({ catalog: () => catalogOf(client.require()) })

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
    // No `resources/ffmpeg/` yet: the bundled binary is a task of its own — see spec § 4.
    bundled: undefined,
    configured: settings.read().media.ffmpegPath,
    onPath: findOnPath('ffmpeg', process.env.PATH, delimiter, existsSync),
    exists: existsSync,
  }))

  const media = createMediaService({
    ffmpeg: ffmpeg.path,
    run: (binary, args, signal, onStdout) => runProcess(binary, args, { signal, onStdout }),
    probe: (source, signal) => probeSource(companionPath(ffmpeg.path()), source, { signal }),
    hash: hashSource,
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

  const jobs = createJobManager({
    runner: runnerOf(() => client.require()),
    collect: createAssetCollector({
      retrieve: async remoteAssetId => {
        const { asset } = await client.require().assets.retrieve(remoteAssetId)
        return { ...asset, metadataType: asset.metadata.type, parentId: asset.metadata.parentId }
      },
      backend: assets,
      newId: newAssetId,
      localIdOf: async remoteAssetId =>
        (await project.catalog().findByRemoteId(remoteAssetId))?.id ?? null,
    }),
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
    // Another key means another catalogue: keeping the cache would show the previous
    // account's models under the new one.
    onCredentialsChanged: () => {
      client.invalidate()
      models.invalidate()
    },
    authState: () => client.authState(),
  }
}

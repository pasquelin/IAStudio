import { app, BrowserWindow, dialog, net, shell, systemPreferences } from 'electron'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, readdirSync } from 'node:fs'
import { chmod, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { availableParallelism, totalmem } from 'node:os'
import { delimiter, dirname, join } from 'node:path'
import { setTimeout as sleepFor } from 'node:timers/promises'
import { activeProvidersOf, scenarioAccount, type AccountSummary } from '@shared/domain/account'
import type { AiOverview } from '@shared/domain/aiOverview'
import { outputExtensionOf } from '@shared/domain/localFields'
import type { LocalModel } from '@shared/domain/localModel'
import { needsOwnFolder } from '@shared/domain/localModel'
import {
  ASSET_ID_PREFIX,
  DEFAULT_ASSET_FOLDERS,
  type Asset,
  type AssetType,
  type MediaProbe,
} from '@shared/domain/asset'
import type { MediaCapabilities } from '@shared/domain/media'
import {
  LEGACY_ASSETS_FOLDER,
  THUMBNAIL_SIZE,
  landedInDefaultFolder,
  planProjectAccount,
  withRecentProject,
  type Project,
  type ProjectAccountPlan,
} from '@shared/domain/project'
import type { PathKind } from '@shared/domain/settingsRegistry'
import { ASSISTANT_MODEL_ID } from '@shared/domain/assistant'
import type { AuthState } from '@shared/domain/settings'
import { log } from './log'
import { textAt, TRANSLATIONS, type Language } from '@shared/i18n'
import { effectiveLanguage } from '@shared/i18n/languages'
import { EVENTS } from '@shared/ipc'
import { isDevelopment } from '@main/environment'
import { createNewsService, type NewsService } from '@main/news/newsStore'
import { createUpdates, type Updates } from '@main/updater'
import { createAssetCollector } from './assets/collector'
import { createCaptioner, type AutoCaption, type DescribeAssets } from './assets/autoCaption'
import { assetFilePath, ownFileOf, posterFileOf, serveAssets } from './assets/protocol'
import { createAssetResolvers } from './assets/assetResolvers'
import { createFavorites, type FavoritesStore } from './favorites/store'
import { createStyles, type StylesStore } from './styles/store'
import { createFfmpegResolver } from './media/ffmpeg'
import {
  bundledAnimations,
  bundledEngine,
  bundledFfmpeg,
  bundledModels,
  bundledTemplates,
  bundledVad,
  resourcesRoot,
} from './resources'
import { bundledFile } from './bundledFile'
import { bundledAnimationFile } from './animations'
import { createAssetText } from './assistant/assetText'
import { createRemoteActions, type RemoteActions } from './mcp/asking'
import { createMcpControl, type McpControl } from './mcp/control'
import type { AssistantBrain } from './assistant/brainPort'
import { createProviderBrain } from './assistant/brainProvider'
import { createLocalBrain } from './assistant/brainLocal'
import { createHttpChatBrain } from './assistant/brainHttp'
import { createRoutedBrain } from './assistant/brainRouted'
import { createSession, type DictationSession } from './dictation/session'
import { STT_MODEL } from '@shared/domain/dictation'
import { chatModelOf, CLOUD_PROVIDERS } from '@shared/domain/aiCloud'
import { ASSISTANT_ROLE } from '@shared/domain/aiRole'
import type { WorkspaceId } from '@shared/domain/workspace'
import { spacesWithNoModel, SPACE_ROLES } from './ai/spacesWithNoModel'
import { createAiManager, type AiManager } from './ai/manager'
import { catalogueWith, modelWith } from './ai/catalogue'
import { electronHardwarePort } from './ai/electronHardwarePort'
import { electronLlamaPort } from './ai/electronLlamaPort'
import { llamaLocalRuntime } from './ai/llamaRuntime'
import { ensureOllama, ollamaInstalled } from './ai/ensureOllama'
import { installEngineLibraries } from './ai/installEngineLibraries'
import { spawnLines } from './ai/spawnLines'
import {
  extractOllamaArchive,
  fetchOllamaArchive,
  installOllama,
  needsZstd,
  zstdOnPath,
} from './ai/installOllama'
import { ollamaHttpPort, ollamaLocalRuntime } from './ai/ollamaRuntime'
import { hardwareProbe, memorySnapshotOf } from './ai/hardwareProbe'
import { readyCloudsOf } from './ai/cloudReadiness'
import { createLocalJobRunner } from './ai/localJobRunner'
import { createRoutedCollector } from './ai/routedCollector'
import { createLocalCollector } from './assets/localCollector'
import { createPythonClient } from './ai/pythonClient'
import { openPythonProcess } from './ai/pythonProcess'
import { pythonRuntime } from './ai/pythonRuntime'
import { createPythonSupervisor } from './ai/pythonSupervisor'
import { fileRuntime, type LocalRuntimes } from './ai/localRuntimes'
import { ownModelFrom } from './ai/ownModel'
import { createRoutedJobRunner } from './ai/routedJobRunner'
import { fetchModel, modelIsComplete } from './ai/modelInstall'
import {
  createDownloadHost,
  defaultModelFolder,
  ensureFolder,
  migrateSttFolder,
} from './ai/modelStore'
import { openMicrophoneSettings, requestMicrophone } from './dictation/permissions'
import { openSttProcess } from './dictation/sttProcess'
import { adoptFile } from './media/adoptFile'
import { linkedAsset, mediaFilters } from './media/link'
import { renderThumbnail } from './media/renderThumbnail'
import { createThumbnailCache } from './project/thumbnailCache'
import {
  binaryRuns,
  companionPath,
  findOnPath,
  forgetBinaries,
  hashOrNull,
  hashSource,
  probeSource,
  runProcess,
} from './media/runner'
import { openPeaksProcess } from './media/peaksProcess'
import { openBundleProcess } from './bundle/bundleProcess'
import type { BundleClient } from './bundle/bundleClient'
import type { PeaksClient } from './media/peaksClient'
import { catchUpMedia } from './media/catchUp'
import { createMediaService, type MediaService } from './media/service'
import { createLocalBackend, type LocalBackend } from './assets/localBackend'
import { createTextureExtraction, type TextureExtraction } from './assets/textureExtraction'
import { broadcast, sendTo } from './ipc/broadcast'
import { studioWindow } from './window/windows'
import { setLogVerbosity } from './log'
import { exists, firstBytes } from './persistence'
import type Scenario from '@scenario-labs/sdk'
import {
  createJobManager,
  type AssetCollector,
  type JobAccount,
  type JobManager,
} from './provider/jobManager'
import { runnerOf } from './provider/runner'
import type { AskUser } from './project/documentDialogs'
import { createDocumentFiles, type DocumentFiles } from './project/documents'
import { createFileOps, type FileOps } from './project/fileOps'
import {
  createFolderReader,
  createFolderWriter,
  watchProjectFolder,
  type FolderReader,
  type FolderWatch,
} from './project/folder'
import { createProjectStore, openFailureKey, orWhenGone, type ProjectStore } from './project/store'
import { createReconciler, type Reconciler } from './project/reconcile'
import { createActivityLog, type ActivityLog } from './project/activityLog'
import { openCatalogThread } from './project/catalogThread'
import { catalogOf } from './provider/modelCatalog'
import { createAssetUploader, MAX_UPLOAD_BYTES, type AssetUploader } from './provider/uploader'
import { createAssetInputResolver } from './provider/assetInputs'
import { createLocalAssetInputResolver } from './ai/localAssetInputs'
import { assetBackendOf, assetCatalogOf, type RemoteAssetCatalog } from './provider/assetCatalog'
import { generationOfMetadata } from './provider/assetNormalizer'
import { createOwnerScope, type OwnerScope } from './provider/ownerScope'
import { accountFingerprint } from './settings/accounts'
import { createCloudBackend, type CloudBackend } from './assets/cloudBackend'
import { isRecord } from '@shared/guards'
import {
  clientFor,
  createClientProvider,
  recordFailuresTo,
  type ClientProvider,
} from './provider/client'
import { costEstimatorOf, type CostEstimator } from './provider/cost'
import { createUsageReader, type UsageReader } from './provider/usage'
import { createJobStore } from './provider/jobStore'
import { createRateLimiters, limitedTransport } from './provider/rateLimiter'
import { createCredentialsWatch } from './provider/credentialsWatch'
import { createModelRegistry, type ModelRegistry } from './provider/modelRegistry'
import { createPlanReader, teamsOf, type PlanReader } from './provider/plan'
import { createAssistQueue } from './provider/assistQueue'
import { createPromptAssist, type PromptAssist } from './provider/promptAssist'
import { promptAssistApiOf } from './provider/promptAssistApi'
import { createElectronAdapter } from './settings/adapter'
import { createSettingsStore, type AccountChange, type SettingsStore } from './settings/store'
import { buildMenu } from './menu'
import { setWindowLanguage, windowLanguage } from './window/language'
import { applyTheme } from './window/theme'

/**
 * Keys queried at once when reading usage. Fixed and low, so that asking about every stored
 * account does not spend one window's worth of requests on a screen nobody is waiting on — the
 * limiter would hold the rest of the studio behind it. It bounds concurrency, not rate: the
 * hundred a minute the API allows is `rateLimiter.ts`'s business.
 */
const USAGE_CONCURRENCY = 4

export type Services = {
  settings: SettingsStore
  client: ClientProvider
  models: ModelRegistry
  jobs: JobManager
  prompts: PromptAssist
  /** What every stored key spent. Consumption only — the API exposes no balance to read. */
  usage: UsageReader
  /** Which models the account's plan may run, so the picker refuses one before the API does. */
  plan: PlanReader
  /** What a run would cost, asked before it is run. See `cost.ts`. */
  estimateCost: CostEstimator
  /**
   * Runs the resolved ffmpeg with those arguments. Exposed because a render encodes too, and a
   * second resolver is how two flows start disagreeing about which binary this machine has.
   */
  encodeVideo: (args: readonly string[], signal?: AbortSignal) => Promise<void>
  /** Names what arrives without a useful name. Never throws, never blocks its caller. */
  captionArrivals: AutoCaption
  /** Names a chosen selection, whatever it is already called. */
  describeAssets: DescribeAssets
  uploads: AssetUploader
  /** The library, as the studio asks about it. Rebuilt per call: the key may have changed. */
  remote: () => RemoteAssetCatalog
  cloud: () => CloudBackend
  ownerScope: OwnerScope
  /** Drops the file an asset owns, leaving a linked one where it lies. */
  removeAssetFile: (asset: Asset) => Promise<void>
  project: ProjectStore
  /** Recipes worth keeping, held outside every project — see `favorites/store.ts`. */
  favorites: FavoritesStore
  /** Saved ways of reading a material, held outside every project — see `styles/store.ts`. */
  styles: StylesStore
  /** What the studio did, and what it failed to do — the surface it had none of. */
  journal: ActivityLog
  /** Settles the note of what is still running. Awaited at quit, beside the journal. */
  flushJobs: () => Promise<void>
  documents: DocumentFiles
  assets: LocalBackend
  /**
   * A model's pictures, taken out into the project. Published because the menu row calls the
   * very same one an import runs on its own — two paths that must never disagree about what a
   * model already has.
   */
  extractTextures: TextureExtraction
  /** Minted here so the collector and the audio editor cannot name assets differently. */
  newAssetId: () => string
  media: MediaService
  /** Works out what a sentence said to the studio meant. Decides nothing and runs nothing. */
  assistant: AssistantBrain
  /**
   * Asking the window in front to run an action that came from outside the application, and
   * waiting for its answer. Held here because two places need the same one: the MCP server,
   * which asks, and the IPC handler, which hears the reply.
   */
  remoteActions: RemoteActions
  /** The MCP server, off unless the setting says otherwise. Followed from `index.ts`. */
  mcp: McpControl
  /** Which AI serves each role, what the machine holds, and what may be installed. */
  ai: AiManager
  /** Rank 3's gesture, whole: a picker, a GGUF header, an entry. Rejects on a file it cannot read. */
  addOwnAiModel: () => Promise<AiOverview>
  /** Speaking instead of typing. Holds the engine, the model and the state of a session. */
  dictation: DictationSession
  /**
   * Lets the local AI engine go, with the door it started.
   *
   * Beside `dictation` and for the same reason: a `utilityProcess` dies with the app, a spawned
   * interpreter does not. Its worker holds gigabytes of device memory, and nothing on the machine
   * gives them back — the SIGTERM handler written into `core/supervisor.py` never fires unless
   * somebody sends the signal.
   */
  disposeAiEngine: () => Promise<void>
  /** Opens the system screen where microphone access is granted back after a refusal. */
  openMicrophoneSettings: () => void
  /** Links a file into the open project — id, timestamp and catalogue row in one move. */
  link: (source: string, type: AssetType) => Promise<Asset>
  /** The same for a file the project already holds, `null` when nothing here opens it. */
  adopt: (relative: string) => Promise<Asset | null>
  capabilities: () => Promise<MediaCapabilities>
  /** The language in force. Injected where it is needed, so no module reads the source itself. */
  language: () => Language
  pickPath: (kind: PathKind) => Promise<string | null>
  savePicture: (name: string, bytes: Uint8Array) => Promise<string | null>
  pickSavePath: (name: string, extension: string) => Promise<string | null>
  /** Where a folder the studio is about to fill goes — an exported texture is several files. */
  pickFolder: () => Promise<string | null>
  /** The process that packs and unpacks a montage bundle, forked on the first one asked for. */
  bundles: () => BundleClient
  /** Where a bundle is read FROM. A file the user pointed at, so nothing confines it. */
  pickImportPath: (extension: string) => Promise<string | null>
  /** Where the open project sits, or nothing when none is — what confines an export by name. */
  projectPath: () => string | null
  /** Shows a file in the OS file manager, so the path never leaves this process. */
  reveal: (file: string) => void
  /** Whether a path is still there — `reveal` above answers nothing for one that has gone. */
  exists: (path: string) => boolean
  /** The project folder, read one level at a time. */
  folder: FolderReader
  /** The pass that puts the catalogue and the project folder back in agreement. */
  reconciler: Reconciler
  /**
   * Everything that WRITES to the project folder, and the stack that takes a batch back.
   *
   * One orchestrator for all of them: disk, then journal, then catalogue, in that order and no
   * other. A rename reaching the disk through a second door is a rename the journal never hears
   * about — which is why the two asset renames live in there rather than here.
   */
  files: FileOps
  /** Hands a file to the system. The one place the studio launches a third-party application. */
  openInSystem: (file: string) => Promise<string>
  /** Asks the user a question the OS puts in front of the window — see `documentDialogs`. */
  askUser: AskUser
  pickMedia: () => Promise<string[]>
  onCredentialsChanged: () => void
  authState: () => Promise<AuthState>
  broadcastAccounts: (accounts: AccountSummary[]) => void
  updates: Updates
  news: NewsService
}

/** Two cores left to the interface and to whatever else the machine is doing — CLAUDE.md § 6. */
const spareCores = (): number => Math.max(1, availableParallelism() - 2)

const timestamp = (): string => new Date().toISOString()
const newAssetId = (): string => `${ASSET_ID_PREFIX}${randomUUID()}`

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

/**
 * Where a file the studio is about to write goes. One dialog for every such question, like
 * `openDialog` above it: a second one with slightly different options is how two save flows
 * start behaving differently.
 */
async function saveDialog(options: Electron.SaveDialogOptions): Promise<string | null> {
  const parent = BrowserWindow.getFocusedWindow()
  const result = parent
    ? await dialog.showSaveDialog(parent, options)
    : await dialog.showSaveDialog(options)

  return result.canceled ? null : (result.filePath ?? null)
}

/**
 * A question with buttons, parented to the window that asked when there is one. Modal to it
 * rather than to the application: a sheet hanging off no window is one the user can lose
 * behind it.
 */
const askUser: AskUser = async options => {
  const parent = BrowserWindow.getFocusedWindow()
  const shown: Electron.MessageBoxOptions = { type: 'warning', ...options }
  const result = parent
    ? await dialog.showMessageBox(parent, shown)
    : await dialog.showMessageBox(shown)

  return result.response
}

/**
 * Asks where a picture goes and writes it there. The renderer has no filesystem, so the bytes
 * come across and the path never goes back the other way beyond the one it chose.
 */
async function savePicture(name: string, bytes: Uint8Array): Promise<string | null> {
  const path = await saveDialog({ defaultPath: name })
  if (!path) return null

  await writeFile(path, bytes)
  return path
}

/**
 * Where an exported scene goes, the writing left to its caller: an export is encoded before the
 * dialog opens, and the scene handler is what turns a path back into a name.
 */
function pickSavePath(name: string, extension: string): Promise<string | null> {
  return saveDialog({
    defaultPath: `${name}${extension}`,
    filters: [{ name: extension.slice(1).toUpperCase(), extensions: [extension.slice(1)] }],
  })
}

/** The one file a reader accepts, named in the language the dialog opens in. */
function pickImportPath(extension: string, language: Language): Promise<string | null> {
  return openDialog({
    properties: ['openFile'],
    filters: [{ name: TRANSLATIONS[language].dialog.bundle, extensions: [extension.slice(1)] }],
  }).then(chosen => chosen[0] ?? null)
}

/** The weights file someone points at — rank 3 of ADR-20, and the gesture is theirs alone. */
function pickWeights(language: Language): Promise<string | null> {
  return openDialog({
    properties: ['openFile'],
    filters: [{ name: TRANSLATIONS[language].dialog.weights, extensions: ['gguf'] }],
  }).then(chosen => chosen[0] ?? null)
}

/** Translated here, where the dialog opens: a native picker shows these names as they are. */
function pickMedia(language: Language): Promise<string[]> {
  const t = TRANSLATIONS[language].dialog
  const filters = mediaFilters({
    all: t.allMedia,
    video: t.video,
    audio: t.audio,
    image: t.image,
    mesh: t.mesh,
  })

  return openDialog({ properties: ['openFile', 'multiSelections'], filters })
}

/** The one wait of the main process. Cancellable, which `setTimeout` in a promise is not. */
const delay = (ms: number, signal?: AbortSignal): Promise<void> =>
  sleepFor(ms, undefined, { signal })

/** `net.fetch` rather than the global one: it goes through Electron's own network stack. */
async function download(url: string): Promise<Uint8Array> {
  const response = await net.fetch(url)
  if (!response.ok) throw new Error(`asset download failed with status ${response.status}`)
  return new Uint8Array(await response.arrayBuffer())
}

/**
 * What this machine asks to be spoken to in: the application's own locale first, the system's
 * preferences behind it.
 *
 * The order is a trade-off rather than a clean win, and the reason is that `getLocale()` is
 * **ambiguous**. It answers the same `en-US` for "this reader set the studio to English" and for
 * "Chromium ships no bundle for what they set, here is the fallback", and nothing tells the two
 * apart — `getSystemLocale()` answers the system in both cases. Leading with it keeps a
 * per-application choice, which macOS offers and which no system preference should overrule.
 *
 * The cost is paid in the other half: a choice Chromium cannot honour reaches this list as
 * `en-US`, and English wins before the system preferences are read. Measured on a French
 * machine — `--lang=de` gives `['de', 'fr-FR']` and now opens in French where it opened in
 * English, while `['en-US', 'fr-FR']` still opens in English. Kept knowingly, and covered by a
 * test in `languages.test.ts` so the next reader meets the trade-off rather than a surprise.
 */
function machineLanguages(): string[] {
  return [app.getLocale(), ...app.getPreferredSystemLanguages()]
}

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
      // Every native surface follows this one call, the menu bar included.
      setWindowLanguage(effectiveLanguage(current.general.language, machineLanguages()))
      buildMenu(current.shortcuts.overrides)
      broadcast(EVENTS.settingsChanged, current)
    },
  })

  const stored = settings.read()

  // Before any window is painted: one created on the OS preference and corrected afterwards
  // flashes the wrong colour for a frame — the splash did exactly that.
  applyTheme(stored.appearance.theme)
  setLogVerbosity(stored.advanced.logLevel)
  setWindowLanguage(effectiveLanguage(stored.general.language, machineLanguages()))

  // Carries a pre-multi-account install over to a book of one. Erases nothing it has not read:
  // a keychain the OS will not open this launch leaves every key exactly where it is.
  settings.settleAccounts()

  return settings
}

/**
 * Composition root of the main process. Everything stateful is built here, once, so no module
 * reaches for a singleton and every collaborator stays injectable in tests.
 *
 * Called after `app.whenReady()`: it registers the asset protocol handler, which Electron
 * refuses before then. The settings are built before it and handed in — see `createSettings`.
 */
export function createServices(settings: SettingsStore): Services {
  // Read off the one copy rather than derived a second time: the file picker below is a native
  // surface too, and a second derivation is what let the menu and the dialogs drift apart.
  const language = (): Language => windowLanguage()

  // Every cache the API fills belongs to one account. They subscribe where they are built, so
  // that a cache added later cannot be left out of a purge list nobody thinks to reread.
  const credentials = createCredentialsWatch()

  // Above the three concurrency bounds the studio already has, none of which decides a rate.
  // `performance.now` and not `Date.now`: a laptop waking up steps the wall clock backwards, and
  // a window holding instants from the future would refuse every call until it caught up.
  const limiters = createRateLimiters({
    now: () => performance.now(),
    delay,
    onSaturated: () => log.info('provider', 'rate limit reached, requests are queueing'),
  })

  // One transport for every client: the one in force, the one a resumed job needs, and the one
  // the usage reader builds per key. Two spellings of it would be two behaviours the day a
  // header is added to one of them.
  const transport = limitedTransport(limiters, (input, init) => fetch(input, init))

  const client = createClientProvider({
    resolve: () => settings.readCredentials(),
    watch: credentials.watch,
    transport,
  })
  /**
   * The merged catalogue, rebuilt only when the supplied list itself moves.
   *
   * The registry memoises on the ARRAY it is handed, so a fresh one per call — which a merge is —
   * defeated it, and the panel recomposed every summary on each keystroke of its search field.
   */
  let merged: { of: string; all: readonly LocalModel[] } | null = null

  const mergedCatalogue = (): readonly LocalModel[] => {
    const own = settings.read().ai.ownModels
    // 🛑 Keyed by the IDS and not by the array: `settings.read()` re-parses, and zod 4 hands back
    // a fresh array every time — measured — so an identity check never held and the merge was
    // rebuilt on every keystroke of the panel's search field, which is what it was written to stop.
    const key = own.map(one => one.id).join('\u0000')
    if (merged?.of !== key) merged = { of: key, all: catalogueWith(own) }

    return merged.all
  }

  /**
   * What is on the disk, answered by the manager — which is built AFTER the registry that asks.
   *
   * A box rather than a forward `let`: the registry keeps this function for the life of the
   * process and asks it per summary, so what it reads has to be able to change under it. Empty
   * until the manager fills it, which reads as "not here yet" — the honest answer meanwhile.
   */
  const installedLocally = { ids: (): ReadonlySet<string> => new Set<string>() }

  const models = createModelRegistry({
    catalog: () => catalogOf(client.require()),
    watch: credentials.watch,
    // The two catalogues merge in `catalogue.ts` and nowhere else: one panel, one set of filters,
    // and a model that says where it runs — ADR-21 as amended.
    localModels: mergedCatalogue,
    // Deferred: the registry is built before the manager, and what is installed changes
    // under it — a download landing must ungrey the card it was greying.
    isInstalled: modelId => installedLocally.ids().has(modelId),
    translate: key => textAt(TRANSLATIONS[language()], key),
  })

  const plan = createPlanReader({
    catalog: () => teamsOf(client.require()),
    watch: credentials.watch,
  })

  // Bounded and separate from the `JobManager`: none of this produces an asset or has a status
  // to poll, and a library fetch of three hundred must not become three hundred calls.
  const assistQueue = createAssistQueue({
    concurrency: () => settings.read().generation.concurrentJobs,
    maxRetries: () => settings.read().generation.maxRetries,
    sleep: delay,
  })

  // Its own client per account rather than the shared one: reading usage asks every stored key
  // at once and must leave the active account exactly as it found it. Through the same transport
  // all the same, so each key spends from its own window rather than around it.
  const usage = createUsageReader({
    accounts: () => settings.keyedAccounts(),
    clientFor: credentials => clientFor(credentials, transport),
    queue: createAssistQueue({
      concurrency: () => USAGE_CONCURRENCY,
      maxRetries: () => settings.read().generation.maxRetries,
      sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),
    }),
    now: () => new Date(),
  })

  // The two need each other: the journal writes into the open project's catalogue, and the
  // project must see the journal emptied before that catalogue stops answering. Read at call
  // time rather than at construction, which is the only order that ties the knot.
  let opened: ActivityLog | null = null

  /**
   * What pointing the open project at the key in force amounted to. `moved` is the only one worth
   * a sentence: the project was working under another key, and the remote library just changed
   * under it.
   */
  type Relink = { kind: 'unchanged' | 'adopted' | 'moved'; active: AccountSummary | null }

  /**
   * Points the open project at whichever account is active now.
   *
   * The link is the project's memory of its key, so it FOLLOWS a switch rather than fighting it:
   * someone who moved to another account and worked an hour there must not find yesterday's key
   * back tomorrow. Saying so is the caller's business — only a switch a USER made is worth a
   * sentence, not one the studio made restoring a link.
   *
   * The active account is handed back with the verdict rather than looked up again: reading the
   * book means decrypting the OS keychain, and the caller needs it to name the key it moved to.
   */
  const linkOpenProject = (): Relink => {
    const current = project.current()
    const accounts = settings.accounts()
    const active = scenarioAccount(accounts)
    if (!current || !active) return { kind: 'unchanged', active }

    const links = settings.read().storage.projectAccounts
    const before = links[current.path]
    if (before === active.id) return { kind: 'unchanged', active }

    settings.write({
      storage: { projectAccounts: { ...links, [current.path]: active.id } },
    })

    // Whether the link EXISTED, not whether the account behind it is still held: removing the
    // active account is a switch too, and the key it fell back to reads another library. Looking
    // the previous account up would answer `null` there and swallow the very warning owed.
    return { kind: before === undefined ? 'adopted' : 'moved', active }
  }

  /**
   * The manager's overview is pulled from inputs it cannot watch — the open project, and the
   * clouds a key is held for. This is the nudge, and it is owed at EVERY one of them: without it a
   * settings window left open keeps a stale path, stale badges and a stale list of providers.
   */
  const republishAi = (after: string): void => {
    void ai.refresh().catch((error: unknown) => {
      log.warn('ai', `republishing after ${after} failed: ${String(error)}`)
    })
  }

  /**
   * Puts the studio back on the account a project last worked under, so reopening it lands on the
   * library it was filled from rather than on whichever key was last switched to elsewhere.
   *
   * The plan is handed in rather than worked out here: the caller needs it to decide what to
   * write, and reading the account book twice means opening the OS keychain twice.
   */
  const applyProjectAccount = (
    plan: ProjectAccountPlan,
    active: AccountSummary | null,
    projectPath: string,
  ): void => {
    if (plan.kind === 'restore') {
      let change: AccountChange
      try {
        change = settings.activateAccount(plan.account.id)
      } catch (error) {
        // A keychain the OS will not open this launch. The project still opens, on the active
        // key: refusing to open a folder over which library it reads would be a worse trade.
        log.warn('project', `restoring the account of ${projectPath} failed: ${String(error)}`)
        return
      }

      // The same two beats `mutate` runs in the settings handlers, and conditioned the same way:
      // the store derives whether the KEY moved, and purging every cache when it did not would
      // cost a refetch of the model catalogue and the plan for nothing.
      if (change.credentialsChanged) credentials.changed()
      broadcast(EVENTS.accountsChanged, change.accounts)
      republishAi('an account change')

      opened?.record({
        level: 'info',
        topic: 'project',
        messageKey: 'activity.projectAccountRestored',
        params: { name: plan.account.name },
      })
      return
    }

    // The key went away — removed, or removed and added back, which mints a new id.
    if (plan.kind === 'missing' && active) {
      opened?.record({
        level: 'warn',
        topic: 'project',
        messageKey: 'activity.projectAccountMissing',
        params: { name: active.name },
      })
    }
  }

  // Same knot: the project store is built before the job manager and has to reach it. Read at
  // call time, and a no-op until there is one to reach.
  const resumeJobsOf = async (projectPath: string): Promise<void> => {
    const remembered = await jobStore.read(projectPath)
    if (remembered.length > 0) jobs.resume(remembered)
  }

  let folderWatch: FolderWatch | null = null

  /**
   * Records the project that just opened: the shelf, the folder to reopen next launch, and which
   * account it works under — in ONE settings write.
   *
   * One and not two, which is what a second call would cost: every write rebuilds the native menu
   * and broadcasts the whole settings object to every window.
   */
  const settleOpenedProject = (current: Project): void => {
    const stored = settings.read()
    const accounts = settings.accounts()
    const active = scenarioAccount(accounts)
    const links = stored.storage.projectAccounts
    const plan = planProjectAccount(links[current.path], accounts)

    // `adopt` alone records a link. A `missing` one is NOT repointed: `persistedBook` answers an
    // empty book when the keychain will not open this launch, so a link would be rewritten to the
    // development account over a lock that lifts on the next launch — destroying what the user
    // chose. The warning repeats until they pick a key, and picking one is what repoints it.
    const adopted = plan.kind === 'adopt' ? active?.id : undefined

    settings.write({
      storage: {
        lastProject: current.path,
        // Written on the same beat as `lastProject`, and replicated with it: the home reads the
        // shelf from the settings every window already holds.
        recentProjects: withRecentProject(stored.storage.recentProjects, current, timestamp()),
        ...(adopted ? { projectAccounts: { ...links, [current.path]: adopted } } : {}),
      },
    })

    applyProjectAccount(plan, active, current.path)
  }

  const project = createProjectStore({
    openCatalog: openCatalogThread,
    now: timestamp,
    onChange: current => {
      if (current) settleOpenedProject(current)
      broadcast(EVENTS.projectChanged, current)

      // Jobs left running by a previous session, picked up here rather than at boot: their
      // outputs land in the project they were generated for, and the catalogue that receives
      // them only exists once one is open.
      if (current) void resumeJobsOf(current.path)

      // Takes that arrived before the pipeline ran on downloads: they hold no length, no
      // waveform and no proxy, and nothing else would ever go back for them. A project opened
      // after the fix would otherwise show exactly what it showed before it.
      if (current) void catchUpProject()

      // One watch at a time, and it belongs to the project that is open: left running, the
      // previous project's folder would go on announcing changes the explorer would answer by
      // re-reading a folder that is no longer on screen.
      folderWatch?.stop()
      folderWatch = current
        ? watchProjectFolder(current.path, () => broadcast(EVENTS.projectFolderChanged))
        : null

      // What moved while the studio was closed. After the journal was replayed — that is what
      // `activate` finishes before it publishes — so a move this session interrupted is already
      // a row at the right path rather than one this pass would go looking for.
      if (current) reconciler.request()

      republishAi('a project change')
    },
    settle: async () => {
      // Both before the catalogue stops answering: the journal writes into it, and the pending
      // jobs are about to be attributed to whichever project opens next.
      await Promise.all([opened?.flush(), jobStore.flush()])
    },
  })

  /**
   * Declared after the store because it reads it, and named before it because the store's own
   * `onChange` asks for the first pass — a function-valued closure either way, so neither has to
   * be built first.
   */
  const reconciler = createReconciler({
    rootOf: () => project.current()?.path ?? null,
    catalogOf: () => (project.current() ? project.catalog() : null),
    announce: state => broadcast(EVENTS.projectRescan, state),
    report: found => {
      /**
       * The windows are told, and this is what makes the pass VISIBLE rather than merely true.
       *
       * Every panel that lists assets reads the catalogue once and then waits to be told —
       * `assets.onChanged` is the shelf's only trigger, and the explorer re-reads its folders on
       * `onFolderChanged`. Without these two lines the pass would refile twelve rows, write its
       * line to the journal, and leave the shelf drawing the answer from before it: thumbnails
       * that open nothing, and assets missing from a library that holds them.
       *
       * Only when something actually changed, which is what keeps a pass on every focus quiet.
       */
      if (found.moved + found.missing + found.returned > 0) {
        broadcast(EVENTS.assetsChanged)
        broadcast(EVENTS.projectFolderChanged)
      }

      // Only what CHANGED, and that is what makes running this on every focus quiet: a pass over
      // a project nothing moved in writes nothing at all.
      if (found.moved > 0) {
        journal.record({
          level: 'info',
          topic: 'project',
          messageKey: 'activity.filesFound',
          params: { count: found.moved },
        })
      }
      if (found.missing > 0) {
        journal.record({
          level: 'warn',
          topic: 'project',
          messageKey: 'activity.filesMissing',
          params: { count: found.missing },
        })
      }
    },
    warn: error => log.warn('project', `reconciling the project folder failed: ${String(error)}`),
  })

  /**
   * The other half of when: the Finder is where a project folder is rearranged, and a window
   * coming back to the front is the moment the studio can find out. One pass at a time, so
   * clicking between two windows does not walk the project twice.
   */
  app.on('browser-window-focus', () => {
    reconciler.request()
  })

  // Reads the catalogue per flush rather than holding one: a project can close and another open
  // while lines are still queued, and a line belongs to whichever project is open when it lands.
  const journal = createActivityLog({
    catalog: () => (project.current() ? project.catalog() : null),
    broadcast: entries => broadcast(EVENTS.activity, entries),
    now: timestamp,
  })
  opened = journal

  // Every reduced API failure, from one place rather than from each handler that remembers to.
  // `describeFailure` is what `reducedBy` already holds — the only text allowed to travel.
  recordFailuresTo((scope, detail) => {
    journal.record({
      level: 'error',
      topic: scope === 'provider' ? 'generation' : 'library',
      messageKey: 'activity.apiRefused',
      detail,
    })
  })

  /**
   * What a file on this disk says about itself, or null when ffprobe is missing or refuses it.
   *
   * One wiring for the three callers that need it — the bytes an import just wrote, the takes a
   * project is catching up on, and the pipeline's own probe step reaches it through its dep.
   */
  const probeLocalFile = async (path: string): Promise<MediaProbe | null> => {
    const outcome = await probeSource(companionPath(ffmpeg.path()), path)
    return outcome.kind === 'probed' ? outcome.probe : null
  }

  /**
   * Writes onto a row the catalogue may have dropped while ffmpeg was running.
   *
   * Nobody awaits this — a proxy that lands after the import it belonged to is answered has no
   * caller left — so the failure it can raise has to be caught here: closing a project while a
   * twenty-minute encode finishes leaves `catalog()` with nothing to answer with.
   */
  const saveAssetFields = (assetId: string, fields: Partial<Asset>): Promise<void> =>
    (async () => {
      const catalog = project.catalog()
      const current = await catalog.find(assetId)
      if (current) await catalog.add({ ...current, ...fields })
    })().catch((error: unknown) =>
      log.warn('media', `could not record what was derived for ${assetId}: ${String(error)}`),
    )

  /**
   * Whether the project holds the folder every asset used to be filed under — that exact entry,
   * and a directory. `existsSync` would answer for a `Assets/` the user made themselves, the case
   * being folded by APFS and NTFS alike, and for a FILE of that name.
   */
  const holdsLegacyAssetsFolder = (root: string): boolean => {
    try {
      return readdirSync(root, { withFileTypes: true }).some(
        entry => entry.name === LEGACY_ASSETS_FOLDER && entry.isDirectory(),
      )
    } catch {
      return false
    }
  }

  /**
   * The projects whose two-tree question has been answered, by folder — answered, not told: a
   * project that turns out to wear ONE tree is settled just as much, and settling it is what
   * keeps a modern project from reading its folder on every import for ever. A set rather than
   * one root, because the answer is per project and the user comes back to the one they left.
   */
  const legacyLayoutSettled = new Set<string>()

  /**
   * A project made before the tree became the user's keeps its files under `assets/`, and nothing
   * migrates them out — leaving them alone is the decision, not an oversight. The import that
   * follows creates `Images/` beside it, and until this line nothing in the app said why one
   * project suddenly wore two trees.
   *
   * The free half of the question first, then ONE reading of the folder per project. Read rather
   * than `existsSync(join(root, 'assets'))`, which answers `true` for a folder the user made and
   * called `Assets` — APFS and NTFS both fold the case — and `true` for a file of that name: the
   * studio would be stating something false about their project and inviting them to tidy it.
   */
  const noteLegacyLayout = (asset: Asset): void => {
    // `current()` and not `path()`, which THROWS when no project is open. This is the first thing
    // `onImported` does, and `announce` swallows what that listener raises: a project closed while
    // the catalogue was answering would have cost a mesh its textures, silently.
    const root = project.current()?.path
    const folder = DEFAULT_ASSET_FOLDERS[asset.type]

    if (!root || legacyLayoutSettled.has(root)) return
    if (!landedInDefaultFolder(asset.path, folder)) return

    legacyLayoutSettled.add(root)
    if (!holdsLegacyAssetsFolder(root)) return

    journal.record({
      level: 'info',
      topic: 'project',
      messageKey: 'activity.projectLegacyAssetsFolder',
      params: { legacy: LEGACY_ASSETS_FOLDER, folder },
    })
  }

  /**
   * What every asset that lands in the project goes through — a download, a generation collected,
   * a file the explorer adopted. Named rather than inlined because the adoption needs the very
   * same derivation: two callers, one deriver, and no way for the two to drift apart.
   */
  const onAssetLanded = (asset: Asset): void => {
    noteLegacyLayout(asset)

    // A take that came down from the API never met the picker, so nothing ever derived what
    // a montage reads: no waveform under its sound clip, and no proxy for a codec the window
    // cannot decode. Both are what `ingest` writes for a file picked off a disk.
    //
    // Only with a probe: `deriveFiles` needs the length, and a `null` one means ffprobe is
    // missing — in which case there is no ffmpeg to derive anything with either.
    if ((asset.type === 'video' || asset.type === 'audio') && asset.probe && asset.path) {
      void media
        .derive({
          assetId: asset.id,
          path: join(project.path() ?? '', asset.path),
          kind: asset.type,
          probe: asset.probe,
          // The library's own still is a picture of the take; ours would be a frame of it.
          poster: !asset.posterPath,
          // The user is waiting on this take: what is being prepared belongs on screen.
          announce: true,
        })
        .then(() => broadcast(EVENTS.assetsChanged))
        .catch((error: unknown) =>
          log.warn('media', `could not derive the files of ${asset.name}: ${String(error)}`),
        )
      return
    }

    if (asset.type !== 'mesh') return
    void extractTextures(asset)
      .then(textures => {
        // The one write no window ordered, so the one nothing else would say out loud: the
        // import that started this is long answered, and its shelf refreshed, by the time a
        // GLB has been read and its pictures written.
        if (textures.length > 0) broadcast(EVENTS.assetsChanged)
      })
      .catch((error: unknown) =>
        // The journal already carries the line `extractTextures` writes; this is the rejection
        // itself, which nothing else would ever hear.
        log.warn('assets', `could not extract the textures of ${asset.name}: ${String(error)}`),
      )
  }

  const assets = createLocalBackend({
    download,
    projectPath: () => project.path(),
    catalog: () => project.catalog(),
    now: timestamp,
    // The same function the rescan hashes with (`projectDisk` passes the very same one), which
    // is what makes the two comparable: a fingerprint recorded here is what lets a generated file
    // be followed after the user files it away themselves.
    hash: hashOrNull,
    // The API states no duration and no track list beside the bytes it hands over, so a
    // generated take reached the timeline as an untimed clip: five arbitrary seconds, and no
    // way to tell whether it carries a sound. ffprobe reads the file that just landed.
    probeFile: probeLocalFile,
    // Every mesh that lands in the project sheds its pictures on the spot, so the inspector has
    // something to show beside a model without anyone having gone looking for a menu row. Not
    // awaited by the import: a model of half a dozen 2048² pictures would otherwise hold up the
    // download that produced it, and a failure here must not cost the model itself.
    onImported: onAssetLanded,
  })

  const extractTextures = createTextureExtraction({
    fileOf: asset => ownFileOf(project.path(), asset),
    search: query => project.catalog().search(query),
    write: (request, bytes) => assets.importFromBytes(request, bytes),
    newAssetId,
    record: report => journal.record(report),
  })

  // Reader and writer together: the handlers take the reading half, the orchestrator below takes
  // the writing one, and neither of them knows the catalogue is involved.
  const folder = {
    ...createFolderReader(() => project.path(), language),
    ...createFolderWriter(
      () => project.path(),
      file => shell.trashItem(file),
    ),
  }

  const documents = createDocumentFiles({
    projectPath: () => project.path(),
    now: timestamp,
    // The listing walks the project through the same reader the explorer does — one walk with
    // one depth bound, rather than a second one free to disagree about how deep a project goes.
    walkFiles: () => folder.walk(),
    folderNames: relative => folder.names(relative),
  })

  const files = createFileOps({
    // `null` rather than `''`: with no project open there is no folder to write in, and every
    // gesture answers an empty outcome instead of resolving a path against nothing.
    rootOf: () => project.current()?.path ?? null,
    folder,
    catalog: () => project.catalog(),
    newBatchId: () => randomUUID(),
    assetsChanged: () => broadcast(EVENTS.assetsChanged),
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
  let bundles: BundleClient | null = null

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
    // The row may have been deleted while a twenty-minute proxy was encoding — see the helper.
    save: saveAssetFields,
    writeFile: async (path, data) => {
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, data)
    },
    onProgress: progress => broadcast(EVENTS.mediaProgress, progress),
    record: report => journal.record(report),
    projectPath: () => project.current()?.path ?? null,
    concurrency: spareCores,
  })

  /** Whether a catch-up is already walking the project — see `catchUpProject`. */
  let catchingUp = false

  /**
   * The takes this project holds that arrived before the pipeline ran on downloads.
   *
   * Behind the project rather than in front of it: nothing here is awaited by the open, and a
   * project that holds none costs one catalogue read. Its own failures are logged and dropped —
   * an ffprobe that is not there must not stop a project from opening.
   */
  const catchUpProject = async (): Promise<void> => {
    // Opening the project that is already open fires `onChange` again — the home shelf and the
    // Recent list both do it. Two runs would list the same rows, neither having a hash yet, and
    // two ffmpeg processes would write the same proxy over each other.
    if (catchingUp) return
    catchingUp = true

    try {
      // Inside the try: `path` throws when no project is open, and this runs on a change that
      // may already have been followed by a close.
      const projectPath = project.path()
      const done = await catchUpMedia({
        list: (offset, limit) =>
          project.catalog().search({ types: ['video', 'audio'], location: 'local', offset, limit }),
        fileOf: asset => ownFileOf(projectPath, asset),
        probeFile: probeLocalFile,
        save: saveAssetFields,
        derive: request => media.derive(request),
        stillOpen: () => project.current()?.path === projectPath,
      })

      // The shelf and the strip both read what was just written, and neither asked for it.
      if (done > 0) broadcast(EVENTS.assetsChanged)
    } catch (error: unknown) {
      log.warn('media', `could not catch up the project's takes: ${String(error)}`)
    } finally {
      catchingUp = false
    }
  }

  /**
   * 🛑 PROVISIONAL, and named so rather than hidden: ADR-19 lists `appBudgetBytes` and
   * `headroomBytes` under what it does NOT decide, and nothing has measured them.
   *
   * `[M]` Three quarters, not a half. At a half, a 16 GB machine offered 5.5 GB once the headroom
   * and the window were taken off, and the 7B model — 8 GB reserved — was unusable on a machine
   * that runs it. The figure is still a policy and not a measurement; what IS measured is that the
   * previous one refused a model that works.
   *
   * On a machine with a dedicated card this is not what decides: the video memory is, and it is
   * READ rather than budgeted — see `potOf` in `hardwareProbe.ts`.
   */
  const PROVISIONAL_BUDGET = {
    appBudgetBytes: Math.round((totalmem() * 3) / 4),
    headroomBytes: 2_000_000_000,
    // What the viewport was measured holding with a 3D scene open, 2026-08-21.
    rendererReservedBytes: 475_000_000,
  }

  // Where the user pointed, or beside the settings file. Read on every call rather than kept:
  // the folder is a setting, and it can change while the studio is open.
  const modelFolder = (): string =>
    settings.read().dictation.modelFolder ?? defaultModelFolder(app.getPath('userData'))

  // Nothing waits on it: what it carries is a model already on the disk, and an install that
  // reaches the new folder first simply downloads what the move would have brought.
  void migrateSttFolder(modelFolder()).catch((error: unknown) => {
    log.warn('ai', `moving the previous model folder failed: ${String(error)}`)
  })

  const downloads = createDownloadHost()

  /**
   * ADR-21 § C: what thinks for each cloud, keyed by the registry. Whether a key is HELD is not
   * here — one account listing answers it for every cloud at once (`activeProvidersOf`).
   * Scenario's brain is a getter because it is built further down.
   */
  const clouds: Record<string, { brain: () => AssistantBrain }> = {}
  for (const cloud of CLOUD_PROVIDERS) {
    // Captured so the narrowing survives into the closures below, which a property access does not.
    const chat = cloud.chat
    if (chat.kind === 'scenario') {
      clouds[cloud.id] = { brain: () => providerBrain }
    } else {
      const http = createHttpChatBrain({
        chat,
        credentials: () => settings.readCredentialsFor(cloud.id),
        model: () => chatModelOf(settings.read().assistant.cloudModels[cloud.id], chat.model),
        notReady,
      })
      clouds[cloud.id] = { brain: () => http }
    }
  }

  /**
   * Where a model's files land. One folder for the whole catalogue — the manifests name their own
   * files — EXCEPT for a loader handed a FOLDER: two of those would overwrite each other's index.
   */
  const folderFor = (model: LocalModel): string =>
    needsOwnFolder(model.loader) ? join(modelFolder(), model.id) : modelFolder()

  /**
   * What each LOADER can do on this machine — the unit ADR-20 writes its whitelist on, and ONE
   * table: a runtime that installs but cannot converse, or the reverse, would otherwise read as
   * ready on one side and be unreachable on the other.
   */
  const fetchedFiles = fileRuntime({
    folderFor,
    isComplete: (model, folder) => modelIsComplete(downloads, model, folder),
    fetch: async (model, folder, onProgress, signal) => {
      await ensureFolder(folder)
      // Nothing sweeps the `.part` files first, and that is the point: an interrupted download
      // resumes from what already arrived. A leftover that is not a prefix of what is being
      // fetched cannot survive anyway — it fails its digest and is removed there.
      await fetchModel(downloads, model, { folder, onProgress, signal })
    },
    removeFiles: async (model, folder) => {
      // The whole folder when it is the model's own, which is what takes its subfolders with it;
      // file by file when it is shared, where a recursive remove would take the catalogue.
      if (needsOwnFolder(model.loader)) {
        await rm(folder, { recursive: true, force: true })
        return
      }

      for (const file of model.files) await rm(join(folder, file.name), { force: true })
    },
  })

  // One port, held: it owns the addon, so the memory reading and the inference are the same
  // process's — which is what lets a snapshot say `runtime` rather than `probe`.
  const llama = electronLlamaPort()
  let hold =
    (_modelId: string): (() => void) =>
    () => {}

  /** A model the person supplied names its own file; everything else lands in the model folder. */
  const weightsOf = (model: LocalModel): string =>
    // The FIRST file: a split GGUF names its shards `-00001-of-0000N`, and llama.cpp is handed
    // the first one and finds the rest beside it.
    model.weightsPath ?? join(modelFolder(), model.files[0]?.name ?? '')

  let lookup = (modelId: string): LocalModel | null =>
    modelWith(modelId, settings.read().ai.ownModels)
  const modelOf = (modelId: string): LocalModel | null => lookup(modelId)
  const isLocalTarget = (targetId: string): boolean => modelOf(targetId) !== null

  /**
   * The local AI engine, supervised. Started on the first ask and never at launch: forking Python
   * to be told nothing is installed would cost a start-up nobody asked for.
   */
  const engine = createPythonSupervisor({
    open: listeners => {
      const bundled = bundledEngine(resourcesRoot(), process.platform)
      return createPythonClient(
        openPythonProcess({
          command: bundled.python,
          args: ['-m', 'ia_studio_engine.core.supervisor'],
          sources: bundled.sources,
          processName: 'the local AI engine',
        }),
        listeners,
      )
    },
    now: Date.now,
    delay: ms => sleepFor(ms),
  })

  const engineRuntime = pythonRuntime({
    folderFor,
    isComplete: (model, folder) => modelIsComplete(downloads, model, folder),
    fetch: async (model, folder, onProgress, signal) => {
      await ensureFolder(folder)
      await fetchModel(downloads, model, { folder, onProgress, signal })
    },
    removeFiles: (_model: LocalModel, folder: string) =>
      rm(folder, { recursive: true, force: true }),
    baseOf: model => (model.attaches ? modelOf(model.attaches.model) : null),
    engine: () => engine.engine(),
    running: () => engine.current(),
    log: (level: 'info' | 'warn', message: string) => log[level]('ai', message),
    onUsed: modelId => hold(modelId),
  })

  const ollamaPort = ollamaHttpPort()
  const ollamaDir = join(app.getPath('userData'), 'ollama')

  const OLLAMA_LOOK_MS = 10_000
  let installedOllama: { at: number; yes: boolean } | null = null

  /**
   * 🛑 `[M]` Remembered, and only for a window: the search joins the usual locations, a studio copy
   * and ONE CANDIDATE PER PATH ENTRY — 46 on this machine — and `some` short-circuits on none of
   * them while Ollama is absent. It sat on every compose, so on every assistant turn.
   */
  const ollamaIsInstalled = (): boolean => {
    if (installedOllama !== null && Date.now() - installedOllama.at < OLLAMA_LOOK_MS) {
      return installedOllama.yes
    }

    installedOllama = {
      at: Date.now(),
      yes: ollamaInstalled(process.platform, process.env, existsSync, ollamaDir),
    }
    return installedOllama.yes
  }
  const startOllama = ensureOllama({
    platform: process.platform,
    env: process.env,
    extraDir: ollamaDir,
    exists: existsSync,
    // Detached and unref'd: a ChildProcess handle would be a way to kill a service we don't own.
    spawn: (command, args) => {
      const child = spawn(command, [...args], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      })
      child.unref()
      child.on('error', error => {
        log.warn('ai', `local chat service did not start: ${String(error)}`)
      })
    },
    ping: () =>
      ollamaPort.tags().then(
        () => true,
        () => false,
      ),
  })

  let forgetDiscovered = (): void => {}
  let refreshOverview = (): Promise<void> => Promise.resolve()
  const runtimes: LocalRuntimes = {
    'sherpa-onnx': fetchedFiles,
    diffusers: engineRuntime,
    plugin: engineRuntime,
    llamacpp: llamaLocalRuntime({
      files: fetchedFiles,
      weightsOf,
      port: llama,
      modelOf,
      onUsed: modelId => hold(modelId),
    }),
    ollama: ollamaLocalRuntime(ollamaPort, {
      ensure: startOllama,
      onStale: () => {
        forgetDiscovered()
        void refreshOverview().catch((error: unknown) => {
          log.warn('ai', `overview unpublished after a stale local model: ${String(error)}`)
        })
      },
    }),
  }

  // Declared before the manager because its `emit` reaches back into it, and `?.` would not save
  // a `const` from its temporal dead zone — an overview emitted during construction would throw.
  let dictation: DictationSession | null = null

  const ai = createAiManager({
    facts: () => hardwareProbe(electronHardwarePort(modelFolder, llama.vram)),
    snapshotOf: (facts, runtimeBytes) =>
      memorySnapshotOf(facts, PROVISIONAL_BUDGET, Date.now(), runtimeBytes),
    settings: () => settings.read(),
    writeSettings: partial => settings.write(partial),
    currentProjectPath: () => project.current()?.path ?? null,
    readyClouds: () => readyCloudsOf(activeProvidersOf(settings.accounts())),
    runtimes,
    emit: overview => {
      broadcast(EVENTS.ai, overview)
      // 🛑 The speech model is in this catalogue, so it is installed and deleted from a screen
      // the session never hears about — without this, a model fetched there left the microphone
      // hidden and the status line offering to download files already on the disk.
      void dictation?.probeModel()
    },
    log: (level, message) => log[level]('ai', message),
    now: Date.now,
    ollamaInstalled: ollamaIsInstalled,
    engineMissing: async () => {
      // Started on this ask: the core imports no tensor library, so this is the 33 ms hello and
      // never a door. Answered `null` when it will not start — unknown, which is not "ready".
      const client = await engine.engine()
      if (!client) return null

      const needs = await client.requirements()
      return [...needs.absent.map(one => one.name), ...needs.stale.map(one => one.name)]
    },
    installEngine: async (onProgress, signal) => {
      const client = await engine.engine()
      if (!client) throw new Error('the local AI engine is not answering')

      await installEngineLibraries({
        python: bundledEngine(resourcesRoot(), process.platform).python,
        // The engine's own declaration, never a list written here.
        declaration: (await client.requirements()).declaration,
        spawn: spawnLines,
        onProgress,
        signal,
      })
    },
    installOllama: async (onProgress, signal) => {
      // The studio just put one there: the remembered answer would keep saying otherwise.
      installedOllama = null
      await installOllama({
        platform: process.platform,
        arch: process.arch,
        env: process.env,
        extraDir: ollamaDir,
        exists: existsSync,
        ensureFolder,
        download: fetchOllamaArchive,
        extract: extractOllamaArchive,
        remove: path => rm(path, { force: true }),
        chmod: path => chmod(path, 0o755),
        ensure: startOllama,
        canUnpack: kind => !needsZstd(kind) || zstdOnPath(),
        onProgress,
        signal,
      })
      installedOllama = null
    },
  })
  // A declaration, not a const: the cloud brains are wired above `ai`, and hoisting is what lets
  // them reach this. 🛑 `unservedRoles`, never `overview()` — see its note on the manager.
  async function notReady(): Promise<readonly WorkspaceId[]> {
    return spacesWithNoModel(await ai.unservedRoles(SPACE_ROLES))
  }

  hold = ai.hold
  lookup = modelId => ai.lookup(modelId)
  forgetDiscovered = () => ai.forgetDiscovered()
  refreshOverview = () => ai.refresh()
  // Filled here rather than captured above: the registry was built first and asks per summary.
  installedLocally.ids = () => ai.installedIds()

  /** The whole of rank 3's gesture: a picker, a header, an entry. */
  const addOwnAiModel = async (): Promise<AiOverview> => {
    const picked = await pickWeights(language())
    if (picked === null) return await ai.overview()

    // A window of the head, never the whole file: a manifest is read out of the first pages, and
    // these files run to gigabytes.
    return await ai.addOwnModel(
      await ownModelFrom(picked, {
        readHead: firstBytes,
        sizeOf: async path => (await stat(path)).size,
      }),
    )
  }

  dictation = createSession({
    modelFolder,
    vadPath: () => bundledVad(resourcesRoot()),
    settings: () => settings.read().dictation,
    modelIsReady: () => modelIsComplete(downloads, STT_MODEL, modelFolder()),
    // Through the manager, which holds the ONE install lock: the status line and the manager
    // screen fetch the same files into the same folder, and two streams onto one `.part` would
    // fail a digest rather than a download.
    download: (onProgress, signal) => ai.installModel(STT_MODEL, onProgress, signal),
    requestMicrophone: () =>
      requestMicrophone({
        platform: process.platform,
        status: () => systemPreferences.getMediaAccessStatus('microphone'),
        ask: () => systemPreferences.askForMediaAccess('microphone'),
      }),
    openEngine: openSttProcess,
    emit: event => broadcast(EVENTS.dictation, event),
    log: (level, message) => log[level]('dictation', message),
    join,
    schedule: (run, delayMs) => {
      const timer = setTimeout(run, delayMs)
      return () => clearTimeout(timer)
    },
  })

  const collectorOf = (scenario: Scenario): AssetCollector =>
    createAssetCollector({
      retrieve: async remoteAssetId => {
        const { asset } = await scenario.assets.retrieve(remoteAssetId)
        const generation = generationOfMetadata(asset.metadata)
        return {
          ...asset,
          metadataType: asset.metadata.type,
          parentId: asset.metadata.parentId,
          ownerId: asset.ownerId,
          updatedAt: asset.updatedAt,
          ...(asset.thumbnail?.url ? { thumbnailUrl: asset.thumbnail.url } : {}),
          ...(asset.metadata.outputIndex === undefined
            ? {}
            : { outputIndex: asset.metadata.outputIndex }),
          ...(generation ? { generation } : {}),
        }
      },
      backend: assets,
      newId: newAssetId,
      // The disk rather than `missing_at`, which the row does not carry out of the catalogue
      // anyway: the date says what the last reconciliation pass saw, and this is asked at the
      // moment the answer is acted on. Through the async `exists` and never `existsSync` — this
      // runs on the main process while a generation is being collected.
      heldFor: async remoteAssetId => {
        const held = await project.catalog().findByRemoteId(remoteAssetId)
        if (!held) return null

        const file = ownFileOf(project.path(), held)
        return { ...held, onDisk: file !== null && (await exists(file)) }
      },
    })

  // Rebuilt only when the client is, so every job of one account shares a single graph rather
  // than allocating its own — what matters is that a job holds ONE binding, not a fresh one.
  let bound: { scenario: Scenario | null; id: string; account: JobAccount } | null = null

  /** The account id a job on THIS machine is filed under. Not a fingerprint: nothing was paid for. */
  const LOCAL_ACCOUNT_ID = 'local'

  /** A job of this machine, told from a cloud's by the id its runner minted. */
  const isLocalJob = (remoteId: string): boolean => remoteId.startsWith('local_')

  const uploads = createAssetUploader(() => client.require().assets)

  // The client in force, resolved per call like every other service here: an estimate is asked
  // before any job exists, so it is the key the user is about to spend from that must price it.
  // `maxRetries: 0`, because a held request is answered with a synthetic 429 the SDK honours:
  // retried twice, one courtesy estimate would take three slots of the window precisely when
  // there are none left, and hold the transport for half a minute for a figure nobody waits on.
  const estimateCost = costEstimatorOf(
    (target, body) =>
      client.require().generate.runModel(target.id, { body, dryRun: true }, { maxRetries: 0 }),
    isLocalTarget,
  )

  const ownerScope = createOwnerScope(credentials.watch)

  /**
   * The one door to the API for assets, wrapped so that listing it teaches the scope which
   * project this key opens onto — there is no endpoint that would simply say.
   *
   * ONLY the listing. `getBulk` fetches ids the renderer chose, and a public asset belonging to
   * someone else would plant the wrong project for the rest of the session: every local asset
   * would then badge as foreign and every push would be refused. A listing is scoped to the key
   * by construction, so it is the only answer that can speak for it.
   */
  const remoteAssets = (): RemoteAssetCatalog => {
    const catalogue = assetCatalogOf(assetBackendOf(client.require()))

    return {
      ...catalogue,
      list: async request => {
        const page = await catalogue.list(request)
        ownerScope.observe(page.assets)
        return page
      },
    }
  }

  const cloudAssets = createCloudBackend({
    remote: remoteAssets,
    multipart: async params => {
      // The helper's return type narrows on a literal `kind`; ours is a value, so what comes
      // back is the union of an asset and a model. Read rather than asserted.
      const result: unknown = await client.require().uploads.uploadFile(params)
      const asset = isRecord(result) && isRecord(result.asset) ? result.asset : null
      if (!asset || typeof asset.id !== 'string') throw new Error('upload-incomplete')

      return {
        assetId: asset.id,
        ...(typeof asset.ownerId === 'string' ? { ownerId: asset.ownerId } : {}),
        ...(typeof asset.updatedAt === 'string' ? { updatedAt: asset.updatedAt } : {}),
      }
    },
    small: (name, image) => uploads.upload(name, image),
    local: assets,
    catalog: () => project.catalog(),
    fileOf: asset => ownFileOf(project.path(), asset),
    readFile: path => readFile(path),
    sizeOf: async path => (await stat(path)).size,
    newId: newAssetId,
    now: timestamp,
    smallUploadLimit: MAX_UPLOAD_BYTES,
  })

  /**
   * The catalogue and the push path an id has to travel through before a job can name it. Both
   * resolved per call, like every other service here: the project and the key both change under
   * a resolver held for the life of the process.
   */
  const assetInputs = createAssetInputResolver({
    find: assetId => project.catalog().find(assetId),
    push: assetId => cloudAssets.push(assetId),
    activeOwnerId: ownerScope.current,
  })

  /** The same pictures, for a model that runs HERE: a path on this disk, and nothing sent. */
  const localAssetInputs = createLocalAssetInputResolver({
    find: assetId => project.catalog().find(assetId),
    projectPath: () => project.path(),
  })

  // Built here rather than beside the other Scenario services, because it needs the resolver
  // above and the resolver needs the project and the cloud backend.
  const prompts = createPromptAssist({
    api: () => promptAssistApiOf(client.require()),
    // Through the registry rather than the API: the generator just described the model to draw
    // the form, so the descriptors are warm and no round trip is spent narrowing the answer.
    fields: async modelId => (await models.describe(modelId)).fields,
    resolvePictureIds: assetInputs.resolvePictureIds,
  })

  /**
   * Drops the file an asset owns. A linked rush is only ever unlinked: the file belongs to
   * whoever pointed at it, and deleting it would take away a take the project never copied.
   */
  const removeAssetFile = async (asset: Asset): Promise<void> => {
    const current = project.current()
    if (!current) return

    // Through the same containment the scheme uses: a stored path is user-editable territory,
    // and `rm` on one that escaped the project would delete a file nobody asked about.
    //
    // The still goes with it, and it is removed even for a LINKED rush whose own file stays put:
    // it is ours, written into the project, and nothing would ever come back for it.
    for (const stored of [asset.path, asset.posterPath]) {
      const file = stored ? assetFilePath(current.path, stored) : null
      if (file) await rm(file, { force: true })
    }
  }

  /**
   * Generations on this machine, behind the shape the job manager speaks — so it keeps holding
   * the queue, the concurrency bound and the retries, and keeps knowing about ONE runner.
   */
  const localJobs = createLocalJobRunner({
    generate: async request => {
      const model = modelOf(request.model)
      const generate = model ? runtimes[model.loader]?.generate : undefined
      if (!model || !generate) throw new Error(`nothing here generates with ${request.model}`)

      const release = ai.hold(request.model)
      try {
        await ai.ensureLoaded(request.model)

        // The main process owns where it lands, and the engine only fills it — which is what makes
        // the file ours to file and ours to delete.
        const folder = join(app.getPath('temp'), 'ia-studio-generations')
        await ensureFolder(folder)

        return await generate({
          model: model.id,
          modality: request.modality,
          prompt: request.prompt,
          fields: request.fields,
          // The extension follows the MODALITY: the collector reads it back off the path to file
          // the asset, so a video written as `.png` lands as a picture nothing can play.
          destination: join(folder, `${request.jobId}.${outputExtensionOf(request.modality)}`),
          onProgress: request.onProgress,
          signal: request.signal,
        })
      } finally {
        release()
      }
    },

    chat: async request => {
      const model = modelOf(request.model)
      const chat = model ? runtimes[model.loader]?.chat : undefined
      if (!chat) throw new Error(`nothing here converses with ${request.model}`)

      return await chat(request)
    },
    modelOf,
    newId: () => randomUUID(),
    log: (level, message) => log[level]('ai', message),
  })

  /**
   * What a generation made HERE leaves behind: a file the studio owns, filed and then dropped.
   *
   * Nothing is retrieved and nothing is downloaded, which is why the cloud collector cannot serve
   * — every branch of it turns on a remote asset id there is none of.
   */
  const collectLocal = createLocalCollector({
    producedBy: jobId => localJobs.producedBy(jobId),
    discard: path => rm(path, { force: true }),
    backend: assets,
    newId: newAssetId,
    log: (level, message) => log[level]('ai', message),
  })

  const accountOn = (scenario: Scenario | null): JobAccount => ({
    runner: createRoutedJobRunner({
      local: localJobs,
      cloud: () => (scenario ? runnerOf(scenario) : null),
      isLocalTarget,
    }),
    // Routed like the runner, and by the same question: a job id says which of the two owns what
    // it produced. A local generation needs no account, so it is collected with none held.
    collect: createRoutedCollector({
      local: collectLocal,
      cloud: () => (scenario ? collectorOf(scenario) : null),
      owns: jobId => localJobs.owns(jobId),
    }),
  })

  const jobStore = createJobStore(() => app.getPath('userData'))

  const jobs = createJobManager({
    accounts: {
      // Read once per job and kept, so a switch mid-flight does not have the new key asked about
      // the previous account's job id — see `JobAccount`.
      // Answered even with no account at all: a generation on this machine needs none, and the
      // routed runner refuses a CLOUD target readably rather than never being reached.
      active: () => {
        const scenario = client.get() ?? null
        const held = settings.readCredentials()

        if (bound?.scenario !== scenario) {
          const id = held ? accountFingerprint(held) : LOCAL_ACCOUNT_ID
          bound = { scenario, id, account: accountOn(scenario) }
        }

        return { id: bound.id, account: bound.account }
      },

      // A client of its own, not the one in force: a job resumed from a previous session belongs
      // to the account that paid for it, whichever one the user has switched to since.
      of: accountId => {
        const credentials = settings.credentialsOf(accountId)
        return credentials ? accountOn(clientFor(credentials, transport)) : null
      },
    },
    projectPath: () => project.current()?.path ?? null,
    // Routed on WHERE the target runs: a local model needs its picture off the disk, and
    // uploading it to an account would be a transfer nobody asked for.
    resolveAssetInputs: (body, target) =>
      isLocalTarget(target.id) ? localAssetInputs.resolveBody(body) : assetInputs.resolveBody(body),
    persist: (unfinished, handled) => {
      // 🛑 A local job is never written down: its whole state lived in the memory of the process
      // that ran it, so a launch that resumed one would poll a runner that has never heard of it.
      const stored = unfinished.filter(job => !isLocalJob(job.remoteId))

      // Nothing waits on this: the write is settled at quit and on a project change, which are
      // the two moments the process may not outlive it. Said out loud all the same — a full disk
      // or an unreadable file turns every note into a no-op, and the loss this whole mechanism
      // exists to prevent would then happen with nothing anywhere saying why.
      void jobStore.write(stored, handled).catch((error: unknown) => {
        log.warn('jobs', `keeping notes of running jobs failed: ${String(error)}`)
      })
    },
    concurrency: () => settings.read().generation.concurrentJobs,
    localConcurrency: () => 1,
    isLocalTarget,
    maxRetries: () => settings.read().generation.maxRetries,
    onProgress: progress => broadcast(EVENTS.jobProgress, progress),
    onListChanged: list => broadcast(EVENTS.jobsChanged, list),
    record: report => journal.record(report),
    now: timestamp,
    newId: () => `job_${randomUUID()}`,
    sleep: delay,
  })

  /**
   * The assistant's thinking, on Scenario's own catalogue model.
   *
   * Through `jobs.run` rather than `jobs.submit`: it is machinery, not a generation, and the
   * difference is what keeps every sentence typed at the assistant out of the jobs bar and its
   * answers out of the asset browser — see `JobManager.run`.
   */
  const providerBrain = createProviderBrain({
    run: body => jobs.run({ id: ASSISTANT_MODEL_ID }, ASSISTANT_MODEL_ID, body),
    readText: createAssetText({
      retrieve: async assetId => (await client.require().assets.retrieve(assetId)).asset,
      // The signed CDN url the asset carries, for the rare answer too long to have been
      // previewed whole. No key goes on this request: the signature is the authorisation.
      download: async url => await (await fetch(url)).text(),
    }),
    model: () => settings.read().assistant.model,
    notReady,
  })

  /**
   * WHICH brain answers is the manager's decision, asked on every turn — ADR-21 § A: the assistant
   * is an employment like any other, served by a model on this machine or by a registered cloud,
   * the local side winning by default.
   */
  const brain = createRoutedBrain({
    providerOf: () => ai.providerOf(ASSISTANT_ROLE),
    modelOf,
    // Both halves are required, and neither is guessed: a runtime that cannot converse and a
    // manifest with no window are the two ways a local model has nothing to answer with.
    localBrain: model => {
      const chat = runtimes[model.loader]?.chat
      if (!chat || model.contextTokens === undefined) return null

      return createLocalBrain({
        chat,
        modelId: model.id,
        contextTokens: model.contextTokens,
        notReady,
      })
    },
    cloudBrain: id => clouds[id]?.brain() ?? null,
  })

  // To the studio window alone, and it says when there is none — which is the difference between
  // an MCP client hearing "no window was there" and waiting out two minutes for nothing.
  const remoteActions = createRemoteActions({
    send: request => sendTo(studioWindow(), EVENTS.assistantAction, request),
  })

  /**
   * The door onto the machine, built here and opened only if the setting says so.
   *
   * Built rather than reached for: the composition root says nothing here reaches for a
   * singleton, and this used to be the exception — a module-level registry, because the settings
   * store is constructed before this is. `SettingsStore.subscribe` closed that hole.
   */
  const mcp = createMcpControl({
    run: remoteActions.run,
    version: app.getVersion(),
    configPath: join(app.getPath('userData'), 'mcp.json'),
  })

  const captioner = createCaptioner({
    queue: assistQueue.run,
    caption: images => prompts.caption(images),
    rename: files.renameAssetToCaption,
    record: report => journal.record(report),
    enabled: () => settings.read().generation.captionArrivals,
  })

  const thumbnails = createThumbnailCache({
    projectPath: () => project.current()?.path ?? null,
    render: async (file, relative) => {
      const drawn = await renderThumbnail(file, THUMBNAIL_SIZE)
      if (drawn) return drawn

      // A `.glb` is a picture no previewer draws, and the library's own still came down beside
      // it. Asked ONLY where the machine failed, so the ordinary tile costs no catalogue query.
      const current = project.current()
      if (!current) return null

      // Both refusals are answered « no preview » rather than thrown, because both are ordinary
      // and `servedPath` now reads a rejection as a defect: the catalogue is closing under this
      // request, or the row names a still the folder no longer holds — what a rescan repairs.
      const [asset] = await orWhenGone(
        () => project.catalog().search({ path: relative, limit: 1 }),
        [],
      )
      const poster = asset ? posterFileOf(current.path, asset) : null
      return poster ? await readFile(poster).catch(() => null) : null
    },
    // The same bound the ingest pool takes: previewing is the system's work, but a folder
    // scrolled fast asks for hundreds at once and each one leaves this process.
    concurrency: spareCores,
  })

  const favorites = createFavorites(join(app.getPath('userData'), 'favorites'))
  const styles = createStyles(() => app.getPath('userData'))

  serveAssets(
    createAssetResolvers({
      projectPath: () => project.current()?.path ?? null,
      findAsset: assetId => project.catalog().find(assetId),
      favouriteThumbnail: favoriteId => favorites.thumbnailPath(favoriteId),
      thumbnailOf: relative => thumbnails.of(relative),
      bundledAnimation: id => bundledAnimationFile(bundledAnimations(resourcesRoot()), id),
      bundledTemplate: file => bundledFile(bundledTemplates(resourcesRoot()), file),
      bundledModel: file => bundledFile(bundledModels(resourcesRoot()), file),
    }),
  )

  const stored = settings.read()
  const lastProject = stored.general.startup === 'lastProject' ? stored.storage.lastProject : null
  // Best effort: the folder may have been moved or deleted since the last session, and that
  // is not a reason to refuse to start. Said out loud all the same — swallowed, a catalogue
  // that fails to open leaves every panel claiming no project is open while the folder is
  // plainly still there, and nothing anywhere says why.
  if (lastProject) {
    void project.open(lastProject).catch((error: unknown) => {
      log.warn('project', `reopening ${lastProject} failed: ${String(error)}`)
      // The same sentence the picker would have shown. Written here as well because this path
      // never reaches a handler: without it, the studio starts with no project and no reason.
      const messageKey = openFailureKey(error)
      if (messageKey) journal.record({ level: 'error', topic: 'project', messageKey })
    })
  }

  return {
    settings,
    favorites,
    styles,
    disposeAiEngine: async () => {
      ai.dispose()
      engine.dispose()
      await llama.unload()
    },
    client,
    models,
    jobs,
    prompts,
    usage,
    plan,
    estimateCost,
    captionArrivals: captioner.onArrival,
    describeAssets: captioner.describe,
    uploads,
    remote: remoteAssets,
    cloud: () => cloudAssets,
    ownerScope,
    removeAssetFile,
    project,
    // `current()` rather than `path()`, which throws: "no project open" is an ordinary answer
    // here, and an export named against nothing is a refusal rather than a failure.
    projectPath: () => project.current()?.path ?? null,
    journal,
    flushJobs: () => jobStore.flush(),
    documents,
    assets,
    extractTextures,
    newAssetId,
    media,
    assistant: brain,
    remoteActions,
    mcp,
    ai,
    addOwnAiModel,
    dictation,
    openMicrophoneSettings: () => openMicrophoneSettings(url => void shell.openExternal(url)),
    link: async (source, type) =>
      await project
        .catalog()
        .add(linkedAsset(source, { id: newAssetId(), type, now: timestamp() })),
    adopt: relative =>
      adoptFile(relative, {
        projectPath: () => project.path(),
        catalog: () => project.catalog(),
        newAssetId,
        now: timestamp,
        hash: hashOrNull,
        probeFile: probeLocalFile,
        onAdopted: onAssetLanded,
        record: report => journal.record(report),
      }),
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
    savePicture,
    pickSavePath,
    encodeVideo: async (args, signal) => {
      const binary = ffmpeg.path()
      if (!binary) throw new Error('ffmpeg was not found')
      await runProcess(binary, args, { signal })
    },
    // The same picker the settings use for a folder: a second dialog with slightly different
    // options is how two flows start behaving differently.
    pickFolder: () => pickPath('folder'),
    // Forked on the first bundle asked for, then kept — most sessions export none. Forgotten
    // when it exits, so a crash costs the export it was writing and not the session.
    bundles: () =>
      (bundles ??= openBundleProcess(() => {
        bundles = null
      })),
    pickImportPath: extension => pickImportPath(extension, language()),
    reveal: file => shell.showItemInFolder(file),
    exists: existsSync,
    folder,
    files,
    reconciler,
    openInSystem: file => shell.openPath(file),
    askUser,
    pickMedia: () => pickMedia(language()),
    // Another key means another catalogue: keeping a cache would show the previous account's
    // contents under the new one. And the open project remembers the switch, so reopening it
    // tomorrow lands on the key it was actually worked under.
    onCredentialsChanged: () => {
      credentials.changed()

      // Only a project that HAD a key is warned. Adopting one for the first time changes nothing
      // about what the library holds, and a sentence there would fire on every project ever made.
      const relink = linkOpenProject()
      if (relink.kind === 'moved' && relink.active) {
        opened?.record({
          level: 'warn',
          topic: 'project',
          messageKey: 'activity.projectAccountSwitched',
          params: { name: relink.active.name },
        })
      }
    },
    authState: async () => {
      const state = await client.authState()
      const owner = ownerScope.current()
      // Attached here rather than probed for: the scope fills in as the library answers, and
      // asking the API again would cost a call to learn something it already told us.
      return state.authenticated && owner !== null ? { ...state, ownerId: owner } : state
    },
    // Every window carries the switch, not just the one that made it — and so does the AI
    // manager, for which clouds are ready is one of the inputs its overview is pulled from.
    broadcastAccounts: accounts => {
      broadcast(EVENTS.accountsChanged, accounts)
      republishAi('an account change')
    },
    // The one outward read this studio makes for something other than a model or a job. Bound
    // to `net.fetch` so it follows the session's proxy, as every other outward call does.
    news: createNewsService({
      read: async (url, signal) => {
        const response = await net.fetch(url, { signal })
        if (!response.ok) throw new Error(`${url} answered ${response.status}`)

        return response.text()
      },
      now: () => Date.now(),
    }),
    updates: createUpdates({
      // Through `default`: `autoUpdater` is a defineProperty getter, which the ESM loader cannot
      // see as a named export. Measured under Electron 43 — the named read answers `undefined`.
      loadUpdater: async () => (await import('electron-updater')).default.autoUpdater,
      isPackaged: !isDevelopment,
      onChange: state => broadcast(EVENTS.updateState, state),
    }),
  }
}

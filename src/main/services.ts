import { orElse } from '@shared/promises'
import { APP_NAME } from '@shared/constants'
import { app, BrowserWindow, dialog, net, shell } from 'electron'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { availableParallelism } from 'node:os'
import { join } from 'node:path'
import { setTimeout as sleepFor } from 'node:timers/promises'
import type { AccountSummary } from '@shared/domain/account'
import type { AiOverview } from '@shared/domain/aiOverview'
import { ASSET_ID_PREFIX, type Asset, type AssetType } from '@shared/domain/asset'
import type { MediaCapabilities } from '@shared/domain/media'
import { THUMBNAIL_SIZE } from '@shared/domain/project'
import type { PathKind } from '@shared/domain/settingsRegistry'
import { ASSISTANT_MODEL_ID } from '@shared/domain/assistant'
import { defaultSettings, type AuthState } from '@shared/domain/settings'
import { log } from './log'
import { TRANSLATIONS, type Language } from '@shared/i18n'
import { effectiveLanguage } from '@shared/i18n/languages'
import { EVENTS } from '@shared/ipc'
import { isDevelopment } from '@main/environment'
import { createNewsService, type NewsService } from '@main/news/newsStore'
import { createUpdates, type Updates } from '@main/updater'
import { createCaptioner, type AutoCaption, type DescribeAssets } from './assets/autoCaption'
import { posterFileOf, serveAssets } from './assets/protocol'
import { createAssetResolvers } from './assets/assetResolvers'
import { createFavorites, type FavoritesStore } from './favorites/store'
import { createStyles, type StylesStore } from './styles/store'
import {
  bundledAnimations,
  bundledGameRuntime,
  bundledModels,
  bundledTemplates,
  bundledTextures,
  resourcesRoot,
} from './resources'
import { bundledFile } from './bundledFile'
import { bundledAnimationFile } from './animations'
import { createAssetText } from './assistant/assetText'
import { createRemoteActions, type RemoteActions } from './mcp/asking'
import { createMcpControl, type McpControl } from './mcp/control'
import {
  checkoutOf,
  clientName,
  mcpConfigWith,
  mcpEndpointPath,
  mcpLaunch,
  mcpStateOf,
  type McpLaunch,
} from './mcp/endpoint'

const MCP_CLIENT = clientName(APP_NAME)
import type { AssistantBrain } from './assistant/brainPort'
import { createProviderBrain } from './assistant/brainProvider'
import { providerLimits } from './assistant/providerLimits'
import { createLocalBrain } from './assistant/brainLocal'
import { projectPickerFolder } from '@shared/domain/project'
import { machineFolders } from './assistant/machineFolders'
import { createRoutedBrain } from './assistant/brainRouted'
import { describeStudio } from './assistant/studioState'
import type { DictationSession } from './dictation/session'
import { ASSISTANT_ROLE } from '@shared/domain/aiRole'
import type { AiManager } from './ai/manager'
import { openMicrophoneSettings } from './dictation/permissions'
import { adoptFile } from './media/adoptFile'
import { linkedAsset, mediaFilters } from './media/link'
import { importFiles } from './media/importFiles'
import { claimExternalFiles } from './externalFiles'
import { renderThumbnail } from './media/renderThumbnail'
import { createThumbnailCache } from './project/thumbnailCache'
import { binaryRuns, forgetBinaries, hashOrNull, runProcess } from './media/runner'
import type { BundleClient } from './bundle/bundleClient'
import type { MediaService } from './media/service'
import type { LocalBackend } from './assets/localBackend'
import type { TextureExtraction } from './assets/textureExtraction'
import { broadcast, sendTo } from './ipc/broadcast'
import { studioWindow } from './window/windows'
import { setLogVerbosity } from './log'
import { writeAtomic } from './persistence'
import type { JobManager } from './provider/jobManager'
import type { AskUser } from './project/documentDialogs'
import type { DocumentFiles } from './project/documents'
import type { FileOps } from './project/fileOps'
import type { ProjectGameStore } from './project/game'
import type { GameScriptStore } from './project/gameScripts'
import type { FolderReader } from './project/folder'
import { composedContext } from '@shared/domain/projectContext'
import type { ProjectContextStore } from '@main/project/context'
import type { PromptContext } from '@main/provider/promptContext'
import { openFailureKey, orWhenGone, type ProjectStore } from './project/store'
import type { Reconciler } from './project/reconcile'
import type { ActivityLog } from './project/activityLog'
import type { Said } from './assistant/said'
import type { Transcript } from './assistant/transcript'
import type { MemoryHost } from './memory/memoryHost'
import type { MemoryVectors } from './memory/memoryVectors'
import { catalogOf } from './provider/modelCatalog'
import type { AssetUploader } from './provider/uploader'
import type { RemoteAssetCatalog } from './provider/assetCatalog'
import type { OwnerScope } from './provider/ownerScope'
import type { CloudBackend } from './assets/cloudBackend'
import type { ClientProvider } from './provider/client'
import type { CostEstimator } from './provider/cost'
import type { UsageReader } from './provider/usage'
import type { ModelRegistry } from './provider/modelRegistry'
import type { PlanReader } from './provider/plan'
import type { CreditsReader } from './provider/credits'
import type { PromptAssist } from './provider/promptAssist'
import { createElectronAdapter } from './settings/adapter'
import { createSettingsStore, type SettingsStore } from './settings/store'
import { buildMenu, noteNavigationPreset, noteRecent } from './menu'
import { setWindowLanguage } from './window/language'
import { applyTheme } from './window/theme'
import { ProviderServices } from './serviceProvider'
import { createLocalAiServices } from './serviceLocalAi'
import { createProjectServices } from './serviceProject'
import { createMediaServices } from './serviceMedia'
import { createJobServices } from './serviceJobs'

/**
 * Keys queried at once when reading usage. Fixed and low, so that asking about every stored
 * account does not spend one window's worth of requests on a screen nobody is waiting on — the
 * limiter would hold the rest of the studio behind it. It bounds concurrency, not rate: the
 * hundred a minute the API allows is `rateLimiter.ts`'s business.
 */
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
  /** What each stored key has LEFT. See `credits.ts`. */
  credits: CreditsReader
  /** What a run would cost, asked before it is run. See `cost.ts`. */
  estimateCost: CostEstimator
  /** The open project's context, joined to what a generation sends. See `promptContext.ts`. */
  promptContext: PromptContext
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
  /** What the assistant has learned — the open project's, and the machine's own. */
  memory: MemoryHost
  /** The embeddings of both memories, and the one process that computes them. */
  memoryVectors: MemoryVectors
  /** Recipes worth keeping, held outside every project — see `favorites/store.ts`. */
  favorites: FavoritesStore
  /** Saved ways of reading a material, held outside every project — see `styles/store.ts`. */
  styles: StylesStore
  /** What the studio did, and what it failed to do — the surface it had none of. */
  journal: ActivityLog
  /** The WHOLE of what the assistant sent and read back — see `assistant/transcript.ts`. */
  transcribe: Transcript
  /** What the last prompts carried, for a reader who unfolds one — see `assistant/said.ts`. */
  said: Said
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
  /** How a client spawns this application as its way in. No address, so it never goes stale. */
  mcpLaunch: McpLaunch
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
  importPaths: (paths: readonly string[], folder: string) => Promise<Asset[]>
  claimExternalFiles: (id: string) => readonly string[]
  capabilities: () => Promise<MediaCapabilities>
  /** The language in force. Injected where it is needed, so no module reads the source itself. */
  language: () => Language
  pickPath: (kind: PathKind) => Promise<string | null>
  savePicture: (name: string, bytes: Uint8Array) => Promise<string | null>
  pickSavePath: (name: string, extension: string) => Promise<string | null>
  /** Where a folder the studio is about to fill goes — an exported texture is several files. */
  pickFolder: () => Promise<string | null>
  /** The catalogue's rows for those ids — what an export follows to find an asset's file. */
  assetsById: (ids: readonly string[]) => Promise<readonly Asset[]>
  /** Where the runtime an exported game embeds sits, beside the app. */
  runtimeFolder: () => string
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
  /** The project's own context, read off the disk on every ask. */
  context: ProjectContextStore
  /**
   * Everything that WRITES to the project folder, and the stack that takes a batch back.
   *
   * One orchestrator for all of them: disk, then journal, then catalogue, in that order and no
   * other. A rename reaching the disk through a second door is a rename the journal never hears
   * about — which is why the two asset renames live in there rather than here.
   */
  files: FileOps
  game: ProjectGameStore
  scripts: GameScriptStore
  /** Hands a file to the system. The one place the studio launches a third-party application. */
  openInSystem: (file: string) => Promise<string>
  /** Asks the user a question the OS puts in front of the window — see `documentDialogs`. */
  askUser: AskUser
  /** Sends a whole project folder to the system's trash, named by its own absolute path. */
  trashFolder: (path: string) => Promise<void>
  /** How many generations have not settled — what closing the project asks about. */
  runningJobCount: () => number
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

/**
 * Our entry added to the checkout's client configuration, which is the PROJECT's file and not
 * ours. A malformed one is left exactly as it is: the throw lands here rather than overwriting it.
 */
async function leaveClientConfig(path: string, launch: McpLaunch): Promise<void> {
  try {
    const merged = mcpConfigWith(await orElse(readFile(path, 'utf8'), ''), launch, MCP_CLIENT)
    if (merged !== null) await writeAtomic(path, merged)
  } catch (error) {
    // An unwritable or unreadable checkout costs a convenience, never a launch.
    log.warn('mcp', `could not leave a client configuration at ${path}: ${String(error)}`)
  }
}

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
    // Passed, never read at the bottom: it is the only setting whose default depends on which
    // run this is, and a development checkout opens its way in with nothing to tick.
    defaults: defaultSettings(isDevelopment),
    onChange: current => {
      // Before the broadcast: the renderer reads `prefers-color-scheme` to resolve `system`,
      // and Chromium only answers with the new value once `themeSource` has moved.
      applyTheme(current.appearance.theme)
      setLogVerbosity(current.advanced.logLevel)
      // Every native surface follows this one call, the menu bar included.
      setWindowLanguage(effectiveLanguage(current.general.language, machineLanguages()))
      buildMenu(current.shortcuts.overrides)
      // After the build, like the shelves: it rebuilds only when the chosen application moved.
      noteNavigationPreset(current.three, preset =>
        settings.write({ three: { ...settings.read().three, navigationPreset: preset } }),
      )
      // After the build above and not before: it rebuilds only when a shelf actually moved, and
      // most settings writes move neither.
      noteRecent(current.storage.recentProjects, current.storage.recentDocuments)
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

/** The clock these two ports are injected with — written twice in this file, forty lines apart. */
const afterDelay = (run: () => void, delayMs: number): (() => void) => {
  const timer = setTimeout(run, delayMs)
  return () => clearTimeout(timer)
}

/**
 * Composition root of the main process. Everything stateful is built here, once, so no module
 * reaches for a singleton and every collaborator stays injectable in tests.
 *
 * Called after `app.whenReady()`: it registers the asset protocol handler, which Electron
 * refuses before then. The settings are built before it and handed in — see `createSettings`.
 */
export function createServices(settings: SettingsStore): Services {
  const provider = new ProviderServices(settings, delay, () =>
    log.info('provider', 'rate limit reached, requests are queueing'),
  )
  const {
    language,
    credentials,
    transport,
    client,
    fromManager,
    holdsTripo,
    generationFolder,
    models,
    plan,
    credits,
    assistQueue,
    usage,
  } = provider
  const projectServices = createProjectServices({
    settings,
    credentialsChanged: credentials.changed,
    now: timestamp,
    refreshAi: () => ai.refresh(),
    resumeJobs: async projectPath => {
      const remembered = await jobStore.read(projectPath)
      if (remembered.length > 0) jobs.resume(remembered)
    },
    catchUpMedia: () => catchUpProject(),
    releaseMemoryVectors: () => memoryVectors.release(),
    flushJobs: () => jobStore.flush(),
  })
  const {
    memory,
    project,
    context,
    reconciler,
    journal,
    transcribe,
    said,
    republishAi,
    linkOpenProject,
  } = projectServices

  const mediaServices = createMediaServices({
    settings,
    project,
    journal,
    language,
    download,
    newAssetId,
    now: timestamp,
    concurrency: spareCores,
  })
  const {
    assets,
    extractTextures,
    folder,
    documents,
    game,
    scripts,
    files,
    ffmpeg,
    media,
    catchUpProject,
    probeLocalFile,
    onAssetLanded,
    bundles,
  } = mediaServices

  const localAi = createLocalAiServices({
    settings,
    project,
    memory,
    fromManager,
    language,
    pickWeights,
    providerBrain: () => providerBrain,
    schedule: afterDelay,
  })
  const {
    clouds,
    runtimes,
    ai,
    engine: localEngine,
    llama,
    modelOf,
    isLocalTarget,
    notReady,
    memoryVectors,
    addOwnAiModel,
    dictation,
  } = localAi

  const jobServices = createJobServices({
    settings,
    credentialsWatch: credentials.watch,
    client,
    transport,
    models,
    context,
    project,
    journal,
    assets,
    runtimes,
    ai,
    modelOf,
    isLocalTarget,
    holdsTripo,
    generationFolder,
    download,
    newAssetId,
    delay,
    now: timestamp,
  })
  const {
    uploads,
    estimateCost,
    promptContext,
    ownerScope,
    remoteAssets,
    cloudAssets,
    prompts,
    removeAssetFile,
    jobStore,
    jobs,
  } = jobServices

  const providerBrain = createProviderBrain({
    run: (body, signal) => jobs.run({ id: ASSISTANT_MODEL_ID }, ASSISTANT_MODEL_ID, body, signal),
    // Invariant 5, applied to the one form of this studio that was written by hand: what the
    // door accepts is read off the model, once, rather than declared here and left to rot.
    limits: providerLimits(
      async () => (await catalogOf(client.require()).retrieve(ASSISTANT_MODEL_ID)).model.inputs,
    ),
    readText: createAssetText({
      retrieve: async assetId => (await client.require().assets.retrieve(assetId)).asset,
      // The signed CDN url the asset carries, for the rare answer too long to have been
      // previewed whole. No key goes on this request: the signature is the authorisation.
      download: async url => await (await fetch(url)).text(),
    }),
    model: () => settings.read().assistant.model,
    notReady,
  })

  // To the studio window alone, and it says when there is none — which is the difference between
  // an MCP client hearing "no window was there" and waiting out two minutes for nothing.
  const remoteActions = createRemoteActions({
    send: request => sendTo(studioWindow(), EVENTS.assistantAction, request),
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
    // Read here rather than taken from the window: this is the one point every brain goes
    // through, and a context a renderer could name is one it could forge.
    contextOf: async () => composedContext((await context.read()).cards),
    // Asked of the window by the door an MCP client reads `studio.state` by: one reading of what
    // the studio is, or the assistant and a client on the wire would see two different studios.
    stateOf: async () => {
      const outcome = await remoteActions.run({ action: 'studio.state', input: {} })
      return outcome.ok ? describeStudio(outcome.data) : ''
    },
    // A count and never a recall: the briefing says a memory EXISTS, the model asks it if it
    // wants to. `held` opens nothing when no project is open.
    memoriesOf: () => memoryVectors.held('project'),
    // Read on every turn rather than once: `app.getPath` answers the live OS folders, which a
    // person can move.
    foldersOf: () => {
      const { projectsFolder, recentProjects } = settings.read().storage
      return machineFolders(
        name => app.getPath(name),
        projectPickerFolder(projectsFolder, recentProjects),
      )
    },
  })

  const checkout = checkoutOf(app.getAppPath())
  const endpointPath = mcpEndpointPath(app.getPath('userData'), checkout)
  const launch = mcpLaunch(process.execPath, checkout, endpointPath)

  // A development checkout gets the client configuration Claude Code reads on its own. It holds
  // no address, so it is written once and never removed — unlike `endpointPath`.
  if (checkout !== null) void leaveClientConfig(join(checkout, '.mcp.json'), launch)

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
    configPath: endpointPath,
    onSettled: endpoint => broadcast(EVENTS.mcpState, mcpStateOf(endpoint)),
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
      return poster ? await orElse(readFile(poster), null) : null
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
      bundledTexture: file => bundledFile(bundledTextures(resourcesRoot()), file),
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

  const adopt = (relative: string): Promise<Asset | null> =>
    adoptFile(relative, {
      projectPath: () => project.path(),
      catalog: () => project.catalog(),
      newAssetId,
      now: timestamp,
      hash: hashOrNull,
      probeFile: probeLocalFile,
      onAdopted: onAssetLanded,
      record: report => journal.record(report),
    })

  return {
    settings,
    favorites,
    styles,
    disposeAiEngine: async () => {
      ai.dispose()
      localEngine.supervisor.dispose()
      await llama.unload()
    },
    client,
    models,
    jobs,
    prompts,
    usage,
    plan,
    credits,
    estimateCost,
    captionArrivals: captioner.onArrival,
    describeAssets: captioner.describe,
    uploads,
    remote: remoteAssets,
    cloud: () => cloudAssets,
    ownerScope,
    removeAssetFile,
    project,
    memory,
    memoryVectors,
    // `current()` rather than `path()`, which throws: "no project open" is an ordinary answer
    // here, and an export named against nothing is a refusal rather than a failure.
    projectPath: () => project.current()?.path ?? null,
    journal,
    transcribe,
    said,
    flushJobs: () => jobStore.flush(),
    documents,
    assets,
    extractTextures,
    newAssetId,
    media,
    assistant: brain,
    remoteActions,
    mcp,
    mcpLaunch: launch,
    ai,
    addOwnAiModel,
    dictation,
    openMicrophoneSettings: () => openMicrophoneSettings(url => void shell.openExternal(url)),
    link: async (source, type) =>
      await project
        .catalog()
        .add(linkedAsset(source, { id: newAssetId(), type, now: timestamp() })),
    adopt,
    importPaths: (paths, target) =>
      importFiles(paths, target, {
        projectPath: () => project.path(),
        names: folder.names,
        adopt,
      }),
    claimExternalFiles,
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
    assetsById: ids => project.catalog().search({ ids, limit: ids.length }),
    runtimeFolder: () => bundledGameRuntime(resourcesRoot()),
    // Forked on the first bundle asked for, then kept — most sessions export none. Forgotten
    // when it exits, so a crash costs the export it was writing and not the session.
    bundles,
    pickImportPath: extension => pickImportPath(extension, language()),
    reveal: file => shell.showItemInFolder(file),
    exists: existsSync,
    folder,
    files,
    game,
    scripts,
    reconciler,
    context,
    promptContext,
    openInSystem: file => shell.openPath(file),
    askUser,
    trashFolder: path => shell.trashItem(path),
    // Nothing to leave means nothing to ask about: `pickedProject` reaches the question on a
    // studio that has never opened a project, where a job of a project closed earlier would
    // otherwise be counted.
    runningJobCount: () => {
      const current = project.current()
      return current ? jobs.runningIn(current.path) : 0
    },
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
        journal.record({
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

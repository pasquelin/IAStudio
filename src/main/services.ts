import { app, BrowserWindow, dialog, net, shell, systemPreferences } from 'electron'
import { randomUUID } from 'node:crypto'
import { existsSync, readdirSync } from 'node:fs'
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { availableParallelism } from 'node:os'
import { delimiter, dirname, join } from 'node:path'
import { setTimeout as sleepFor } from 'node:timers/promises'
import type { AccountSummary } from '@shared/domain/account'
import {
  ASSET_HOST,
  ASSET_ID_PREFIX,
  DEFAULT_ASSET_FOLDERS,
  POSTER_HOST,
  THUMB_HOST,
  type Asset,
  type AssetType,
  type MediaProbe,
} from '@shared/domain/asset'
import type { MediaCapabilities } from '@shared/domain/media'
import { FAVORITE_HOST } from '@shared/domain/favorite'
import {
  LEGACY_ASSETS_FOLDER,
  THUMBNAIL_SIZE,
  landedInDefaultFolder,
  planProjectAccount,
  withRecentProject,
  type Project,
  type ProjectAccountPlan,
} from '@shared/domain/project'
import type { PathKind } from '@shared/domain/settings-registry'
import { ASSISTANT_MODEL_ID } from '@shared/domain/assistant'
import type { AuthState } from '@shared/domain/settings'
import { log } from './log'
import { TRANSLATIONS, type Language } from '@shared/i18n'
import { effectiveLanguage } from '@shared/i18n/languages'
import { EVENTS } from '@shared/ipc'
import { isDevelopment } from '@main/environment'
import { createUpdates, type Updates } from '@main/updater'
import { createAssetCollector } from './assets/collector'
import { createCaptioner, type AutoCaption, type DescribeAssets } from './assets/auto-caption'
import {
  assetFilePath,
  ownFileOf,
  posterFileOf,
  serveAssets,
  servedFileOf,
} from './assets/protocol'
import { createFavorites, type FavoritesStore } from './favorites/store'
import { createStyles, type StylesStore } from './styles/store'
import { createFfmpegResolver } from './media/ffmpeg'
import { bundledFfmpeg, bundledVad, resourcesRoot } from './resources'
import { createAssetText } from './assistant/asset-text'
import { createRemoteActions, type RemoteActions } from './mcp/asking'
import { createMcpControl, type McpControl } from './mcp/control'
import type { AssistantBrain } from './assistant/brain-port'
import { createScenarioBrain } from './assistant/brain-scenario'
import { createSession, type DictationSession } from './dictation/session'
import { fetchModel, modelIsComplete } from './dictation/model-download'
import { createDownloadHost, defaultModelFolder, ensureFolder } from './dictation/model-store'
import { openMicrophoneSettings, requestMicrophone } from './dictation/permissions'
import { openSttProcess } from './dictation/stt-process'
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
import { openPeaksProcess } from './media/peaks-process'
import type { PeaksClient } from './media/peaks-client'
import { catchUpMedia } from './media/catch-up'
import { createMediaService, type MediaService } from './media/service'
import { createLocalBackend, type LocalBackend } from './assets/local-backend'
import { createTextureExtraction, type TextureExtraction } from './assets/texture-extraction'
import { broadcast, sendTo } from './ipc/broadcast'
import { studioWindow } from './window/windows'
import { setLogVerbosity } from './log'
import { exists } from './persistence'
import type Scenario from '@scenario-labs/sdk'
import {
  createJobManager,
  type AssetCollector,
  type JobAccount,
  type JobManager,
} from './scenario/job-manager'
import { runnerOf } from './scenario/runner'
import type { AskUser } from './project/document-dialogs'
import { createDocumentFiles, type DocumentFiles } from './project/documents'
import { createFileOps, type FileOps } from './project/file-ops'
import {
  createFolderReader,
  createFolderWriter,
  watchProjectFolder,
  type FolderReader,
  type FolderWatch,
} from './project/folder'
import { createProjectStore, openFailureKey, type ProjectStore } from './project/store'
import { createReconciler, type Reconciler } from './project/reconcile'
import { createActivityLog, type ActivityLog } from './project/activity-log'
import { openCatalogThread } from './project/catalog-thread'
import { catalogOf } from './scenario/model-catalog'
import { createAssetUploader, MAX_UPLOAD_BYTES, type AssetUploader } from './scenario/uploader'
import { createAssetInputResolver } from './scenario/asset-inputs'
import { assetBackendOf, assetCatalogOf, type RemoteAssetCatalog } from './scenario/asset-catalog'
import { generationOfMetadata } from './scenario/asset-normalizer'
import { createOwnerScope, type OwnerScope } from './scenario/owner-scope'
import { accountFingerprint } from './settings/accounts'
import { createCloudBackend, type CloudBackend } from './assets/cloud-backend'
import { isRecord } from '@shared/guards'
import {
  clientFor,
  createClientProvider,
  recordFailuresTo,
  type ClientProvider,
} from './scenario/client'
import { costEstimatorOf, type CostEstimator } from './scenario/cost'
import { createUsageReader, type UsageReader } from './scenario/usage'
import { createJobStore } from './scenario/job-store'
import { createRateLimiters, limitedTransport } from './scenario/rate-limiter'
import { createCredentialsWatch } from './scenario/credentials-watch'
import { createFileSystemFallback, environmentAccount } from './scenario/credentials'
import { createModelRegistry, type ModelRegistry } from './scenario/model-registry'
import { createPlanReader, teamsOf, type PlanReader } from './scenario/plan'
import { createAssistQueue } from './scenario/assist-queue'
import { createPromptAssist, type PromptAssist } from './scenario/prompt-assist'
import { promptAssistApiOf } from './scenario/prompt-assist-api'
import { createElectronAdapter } from './settings/adapter'
import { createSettingsStore, type AccountChange, type SettingsStore } from './settings/store'
import { buildMenu } from './menu'
import { setWindowLanguage, windowLanguage } from './window/language'
import { applyTheme } from './window/theme'

/**
 * Keys queried at once when reading usage. Fixed and low, so that asking about every stored
 * account does not spend one window's worth of requests on a screen nobody is waiting on — the
 * limiter would hold the rest of the studio behind it. It bounds concurrency, not rate: the
 * hundred a minute the API allows is `rate-limiter.ts`'s business.
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
  encodeVideo: (args: readonly string[]) => Promise<void>
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
  /** Speaking instead of typing. Holds the engine, the model and the state of a session. */
  dictation: DictationSession
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
  /** Asks the user a question the OS puts in front of the window — see `document-dialogs`. */
  askUser: AskUser
  pickMedia: () => Promise<string[]>
  onCredentialsChanged: () => void
  authState: () => Promise<AuthState>
  broadcastAccounts: (accounts: AccountSummary[]) => void
  updates: Updates
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
    onSaturated: () => log.info('scenario', 'rate limit reached, requests are queueing'),
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
  const models = createModelRegistry({
    catalog: () => catalogOf(client.require()),
    watch: credentials.watch,
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
    const active = accounts.find(account => account.active) ?? null
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
   * Puts the studio back on the account a project last worked under, so reopening it lands on the
   * library it was filled from rather than on whichever key was last switched to elsewhere.
   *
   * The plan is handed in rather than worked out here: the caller needs it to decide what to
   * write, and reading the account book twice means opening the OS keychain twice.
   */
  const applyProjectAccount = (
    plan: ProjectAccountPlan,
    active: AccountSummary | undefined,
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
    const active = accounts.find(account => account.active)
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
      topic: scope === 'scenario' ? 'generation' : 'library',
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
    // The same function the rescan hashes with (`project-disk` passes the very same one), which
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

  // The model is read from where the user pointed, or from beside the settings file. Read on
  // every call rather than kept: the folder is a setting, and it can change while the studio
  // is open.
  const modelFolder = (): string =>
    settings.read().dictation.modelFolder ?? defaultModelFolder(app.getPath('userData'))

  const downloads = createDownloadHost()

  const dictation = createSession({
    modelFolder,
    vadPath: () => bundledVad(resourcesRoot()),
    settings: () => settings.read().dictation,
    modelIsReady: () => modelIsComplete(downloads, modelFolder()),
    download: async (onProgress, signal) => {
      const folder = modelFolder()
      await ensureFolder(folder)
      // Nothing sweeps the `.part` files first, and that is the point: an interrupted download
      // resumes from what already arrived. A leftover that is not a prefix of what is being
      // fetched cannot survive anyway — it fails its digest and is removed there.
      await fetchModel(downloads, { folder, onProgress, signal })
    },
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
  let bound: { scenario: Scenario; id: string; account: JobAccount } | null = null

  const uploads = createAssetUploader(() => client.require().assets)

  // The client in force, resolved per call like every other service here: an estimate is asked
  // before any job exists, so it is the key the user is about to spend from that must price it.
  // `maxRetries: 0`, because a held request is answered with a synthetic 429 the SDK honours:
  // retried twice, one courtesy estimate would take three slots of the window precisely when
  // there are none left, and hold the transport for half a minute for a figure nobody waits on.
  const estimateCost = costEstimatorOf((target, body) =>
    client.require().generate.runModel(target.id, { body, dryRun: true }, { maxRetries: 0 }),
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

  const accountOn = (scenario: Scenario): JobAccount => ({
    runner: runnerOf(scenario),
    collect: collectorOf(scenario),
  })

  const jobStore = createJobStore(() => app.getPath('userData'))

  const jobs = createJobManager({
    accounts: {
      // Read once per job and kept, so a switch mid-flight does not have the new key asked about
      // the previous account's job id — see `JobAccount`.
      active: () => {
        const scenario = client.get()
        const held = settings.readCredentials()
        if (!scenario || !held) return null

        if (bound?.scenario !== scenario) {
          bound = { scenario, id: accountFingerprint(held), account: accountOn(scenario) }
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
    resolveAssetInputs: assetInputs.resolveBody,
    persist: (unfinished, handled) => {
      // Nothing waits on this: the write is settled at quit and on a project change, which are
      // the two moments the process may not outlive it. Said out loud all the same — a full disk
      // or an unreadable file turns every note into a no-op, and the loss this whole mechanism
      // exists to prevent would then happen with nothing anywhere saying why.
      void jobStore.write(unfinished, handled).catch((error: unknown) => {
        log.warn('jobs', `keeping notes of running jobs failed: ${String(error)}`)
      })
    },
    concurrency: () => settings.read().generation.concurrentJobs,
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
  const brain = createScenarioBrain({
    run: body => jobs.run({ id: ASSISTANT_MODEL_ID }, ASSISTANT_MODEL_ID, body),
    readText: createAssetText({
      retrieve: async assetId => (await client.require().assets.retrieve(assetId)).asset,
      // The signed CDN url the asset carries, for the rare answer too long to have been
      // previewed whole. No key goes on this request: the signature is the authorisation.
      download: async url => await (await fetch(url)).text(),
    }),
    model: () => settings.read().assistant.model,
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

      const [asset] = await project.catalog().search({ path: relative, limit: 1 })
      const poster = asset ? posterFileOf(current.path, asset) : null
      return poster ? await readFile(poster) : null
    },
    // The same bound the ingest pool takes: previewing is the system's work, but a folder
    // scrolled fast asks for hundreds at once and each one leaves this process.
    concurrency: spareCores,
  })

  const favorites = createFavorites(join(app.getPath('userData'), 'favorites'))
  const styles = createStyles(() => app.getPath('userData'))

  serveAssets({
    [ASSET_HOST]: async assetId => {
      const current = project.current()
      if (!current) return null

      const asset = await project.catalog().find(assetId)
      return asset ? servedFileOf(current.path, asset) : null
    },
    [POSTER_HOST]: async assetId => {
      const current = project.current()
      if (!current) return null

      const asset = await project.catalog().find(assetId)
      return asset ? posterFileOf(current.path, asset) : null
    },
    [FAVORITE_HOST]: favoriteId => Promise.resolve(favorites.thumbnailPath(favoriteId)),
    // Named by a PATH rather than by an id, alone among the four: the explorer draws files, and
    // most of what it draws the catalogue has never heard of. `assetFilePath` refuses whatever
    // walks out of the project, exactly as it does for a row.
    [THUMB_HOST]: relative => thumbnails.of(relative),
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
    encodeVideo: async args => {
      const binary = ffmpeg.path()
      if (!binary) throw new Error('ffmpeg was not found')
      await runProcess(binary, args)
    },
    // The same picker the settings use for a folder: a second dialog with slightly different
    // options is how two flows start behaving differently.
    pickFolder: () => pickPath('folder'),
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
    // Every window carries the switch, not just the one that made it: the studio and the
    // settings window both show which account is active.
    broadcastAccounts: accounts => broadcast(EVENTS.accountsChanged, accounts),
    updates: createUpdates({
      // Through `default`: `autoUpdater` is a defineProperty getter, which the ESM loader cannot
      // see as a named export. Measured under Electron 43 — the named read answers `undefined`.
      loadUpdater: async () => (await import('electron-updater')).default.autoUpdater,
      isPackaged: !isDevelopment,
      onChange: state => broadcast(EVENTS.updateState, state),
    }),
  }
}

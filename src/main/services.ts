import { app, BrowserWindow, dialog, net, shell } from 'electron'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { availableParallelism } from 'node:os'
import { delimiter, dirname, join } from 'node:path'
import { setTimeout as sleepFor } from 'node:timers/promises'
import type { AccountSummary } from '@shared/domain/account'
import { ASSET_HOST, type Asset, type AssetType } from '@shared/domain/asset'
import type { MediaCapabilities } from '@shared/domain/media'
import { FAVORITE_HOST } from '@shared/domain/favorite'
import { withRecentProject } from '@shared/domain/project'
import type { PathKind } from '@shared/domain/settings-registry'
import type { AuthState } from '@shared/domain/settings'
import { log } from './log'
import { TRANSLATIONS, type Language } from '@shared/i18n'
import { effectiveLanguage } from '@shared/i18n/languages'
import { EVENTS } from '@shared/ipc'
import { isDevelopment } from '@main/environment'
import { createUpdates, type Updates } from '@main/updater'
import { createAssetCollector } from './assets/collector'
import { createCaptioner, type AutoCaption, type DescribeAssets } from './assets/auto-caption'
import { assetFilePath, ownFileOf, serveAssets, servedFileOf } from './assets/protocol'
import { createFavorites, type FavoritesStore } from './favorites/store'
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
import type { AskUser } from './project/document-dialogs'
import { createDocumentFiles, type DocumentFiles } from './project/documents'
import { createProjectStore, type ProjectStore } from './project/store'
import { createActivityLog, type ActivityLog } from './project/activity-log'
import { openCatalogThread } from './project/catalog-thread'
import { catalogOf } from './scenario/model-catalog'
import { createAssetUploader, MAX_UPLOAD_BYTES, type AssetUploader } from './scenario/uploader'
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
import { createWorkflowRegistry, type WorkflowRegistry } from './scenario/workflow-registry'
import { workflowCatalogOf } from './scenario/workflow-catalog'
import { createAssistQueue } from './scenario/assist-queue'
import { createPromptAssist, type PromptAssist } from './scenario/prompt-assist'
import { promptAssistApiOf } from './scenario/prompt-assist-api'
import { createElectronAdapter } from './settings/adapter'
import { createSettingsStore, type SettingsStore } from './settings/store'
import { buildMenu } from './menu'
import { setWindowLanguage } from './window/language'
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
  /** Scenario's workflows, and the public ones — the Apps — the studio can run as they are. */
  workflows: WorkflowRegistry
  jobs: JobManager
  prompts: PromptAssist
  /** What every stored key spent. Consumption only — the API exposes no balance to read. */
  usage: UsageReader
  /** What a run would cost, asked before it is run — of a model or of a workflow. See `cost.ts`. */
  estimateCost: CostEstimator
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
  /** What the studio did, and what it failed to do — the surface it had none of. */
  journal: ActivityLog
  /** Settles the note of what is still running. Awaited at quit, beside the journal. */
  flushJobs: () => Promise<void>
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
  savePicture: (name: string, bytes: Uint8Array) => Promise<string | null>
  pickSavePath: (name: string, extension: string) => Promise<string | null>
  /** Shows a file in the OS file manager, so the path never leaves this process. */
  reveal: (file: string) => void
  /** Asks the user a question the OS puts in front of the window — see `document-dialogs`. */
  askUser: AskUser
  pickMedia: () => Promise<string[]>
  onCredentialsChanged: () => void
  authState: () => Promise<AuthState>
  broadcastAccounts: (accounts: AccountSummary[]) => void
  updates: Updates
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

  const workflows = createWorkflowRegistry({
    catalog: () => workflowCatalogOf(client.require()),
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

  const prompts = createPromptAssist({
    api: () => promptAssistApiOf(client.require()),
    // Through the registry rather than the API: the generator just described the model to draw
    // the form, so the descriptors are warm and no round trip is spent narrowing the answer.
    fields: async modelId => (await models.describe(modelId)).fields,
  })

  // The two need each other: the journal writes into the open project's catalogue, and the
  // project must see the journal emptied before that catalogue stops answering. Read at call
  // time rather than at construction, which is the only order that ties the knot.
  let opened: ActivityLog | null = null

  // Same knot: the project store is built before the job manager and has to reach it. Read at
  // call time, and a no-op until there is one to reach.
  const resumeJobsOf = async (projectPath: string): Promise<void> => {
    const remembered = await jobStore.read(projectPath)
    if (remembered.length > 0) jobs.resume(remembered)
  }

  const project = createProjectStore({
    openCatalog: openCatalogThread,
    now: timestamp,
    onChange: current => {
      if (current) {
        settings.write({
          storage: {
            lastProject: current.path,
            // Written on the same beat as `lastProject`, and replicated with it: the home reads
            // the shelf from the settings every window already holds.
            recentProjects: withRecentProject(
              settings.read().storage.recentProjects,
              current,
              timestamp(),
            ),
          },
        })
      }
      broadcast(EVENTS.projectChanged, current)

      // Jobs left running by a previous session, picked up here rather than at boot: their
      // outputs land in the project they were generated for, and the catalogue that receives
      // them only exists once one is open.
      if (current) void resumeJobsOf(current.path)
    },
    settle: async () => {
      // Both before the catalogue stops answering: the journal writes into it, and the pending
      // jobs are about to be attributed to whichever project opens next.
      await Promise.all([opened?.flush(), jobStore.flush()])
    },
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
    record: report => journal.record(report),
    projectPath: () => project.current()?.path ?? null,
    // Two cores left to the interface and to whatever else the machine is doing.
    concurrency: () => Math.max(1, availableParallelism() - 2),
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
          ...(asset.metadata.outputIndex === undefined
            ? {}
            : { outputIndex: asset.metadata.outputIndex }),
          ...(generation ? { generation } : {}),
        }
      },
      backend: assets,
      newId: newAssetId,
      heldFor: remoteAssetId => project.catalog().findByRemoteId(remoteAssetId),
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
  // Both endpoints price a dry run the same way, which is why the estimator takes a function:
  // what runs decides which one is asked, exactly as it does for running it.
  const estimateCost = costEstimatorOf((target, body) =>
    target.kind === 'workflow'
      ? client.require().workflows.run(target.id, { body, dryRun: true }, { maxRetries: 0 })
      : client.require().generate.runModel(target.id, { body, dryRun: true }, { maxRetries: 0 }),
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
   * Drops the file an asset owns. A linked rush is only ever unlinked: the file belongs to
   * whoever pointed at it, and deleting it would take away a take the project never copied.
   */
  const removeAssetFile = async (asset: Asset): Promise<void> => {
    const current = project.current()
    if (!current || !asset.path) return

    // Through the same containment the scheme uses: a stored path is user-editable territory,
    // and `rm` on one that escaped the project would delete a file nobody asked about.
    const file = assetFilePath(current.path, asset.path)
    if (file) await rm(file, { force: true })
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

  const captioner = createCaptioner({
    queue: assistQueue.run,
    caption: images => prompts.caption(images),
    save: asset => project.catalog().add(asset),
    record: report => journal.record(report),
    enabled: () => settings.read().generation.captionArrivals,
  })

  const favorites = createFavorites(join(app.getPath('userData'), 'favorites'))

  serveAssets({
    [ASSET_HOST]: async assetId => {
      const current = project.current()
      if (!current) return null

      const asset = await project.catalog().find(assetId)
      return asset ? servedFileOf(current.path, asset) : null
    },
    [FAVORITE_HOST]: favoriteId => Promise.resolve(favorites.thumbnailPath(favoriteId)),
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
    favorites,
    client,
    models,
    workflows,
    jobs,
    prompts,
    usage,
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
    savePicture,
    pickSavePath,
    reveal: file => shell.showItemInFolder(file),
    askUser,
    pickMedia: () => pickMedia(language()),
    // Another key means another catalogue: keeping a cache would show the previous account's
    // contents under the new one.
    onCredentialsChanged: credentials.changed,
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
      loadUpdater: async () => (await import('electron-updater')).autoUpdater,
      isPackaged: app.isPackaged,
      onChange: state => broadcast(EVENTS.updateState, state),
    }),
  }
}

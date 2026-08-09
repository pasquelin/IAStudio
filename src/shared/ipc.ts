import type { AccountSummary, AccountsResult } from './domain/account'
import type { ActivityEntry, ActivityQuery } from './domain/activity'
import type { Asset, AssetChanges, AssetCounts, AssetQuery } from './domain/asset'
import type { FavoriteRecipe } from './domain/favorite'
import type { CloudPage, CloudQuery } from './domain/cloud-asset'
import type { CommandId } from './domain/command'
import type {
  CloseChoice,
  DocumentDescriptor,
  DocumentDraft,
  DocumentFile,
  DocumentKind,
} from './domain/document'
import type { CostEstimate, Job, JobProgress, JobTarget } from './domain/job'
import type { IngestProgress, MediaCapabilities } from './domain/media'
import type { ModelDescriptor, ModelPage, ModelQuery } from './domain/model'
import type { Project } from './domain/project'
import type {
  PromptStyle,
  PromptSuggestion,
  PromptTranslation,
  SuggestPromptsRequest,
} from './domain/prompt-assist'
import type { ExportFormat, LightKind, MeshKind, ObjectKind } from './domain/scene'
import type { AuthState, PartialSettings, Settings, SettingsSectionId } from './domain/settings'
import type { PathKind, SettingActionId } from './domain/settings-registry'
import type { SyncOutcome, SyncPlan, SyncPolicy } from './domain/sync'
import type { ToolId, ToolZone } from './domain/tool'
import type { UpdateState } from './domain/update'
import type { UsageCursors, UsageEventPage, UsagePeriod, UsageReport } from './domain/usage'
import type { WindowState } from './domain/window'
import type { WorkflowDescriptor, WorkflowPage, WorkflowQuery } from './domain/workflow'
import type { WorkspaceId } from './domain/workspace'

/**
 * Channel names, declared with literal types. The annotation is verbose on purpose: the
 * project forbids `as const`, and without literal types `CHANNELS.settingsRead` widens to
 * `string`, which collapses every channel-keyed table in the main process into one index
 * signature — and the boundary stops being typed.
 */
export type Channels = {
  settingsRead: 'settings:read'
  settingsWrite: 'settings:write'
  settingsAuthState: 'settings:auth-state'
  settingsOpen: 'settings:open'
  settingsRunAction: 'settings:run-action'
  settingsPending: 'settings:pending'

  accountsList: 'accounts:list'
  accountsAdd: 'accounts:add'
  accountsRename: 'accounts:rename'
  accountsRemove: 'accounts:remove'
  accountsActivate: 'accounts:activate'

  scenarioSearchModels: 'scenario:search-models'
  scenarioModelPreviews: 'scenario:model-previews'
  scenarioDescribeModel: 'scenario:describe-model'
  scenarioSuggestPrompts: 'scenario:suggest-prompts'
  scenarioTranslatePrompt: 'scenario:translate-prompt'
  scenarioDescribeStyle: 'scenario:describe-style'
  scenarioGenerate: 'scenario:generate'
  scenarioEstimateCost: 'scenario:estimate-cost'
  scenarioUploadAsset: 'scenario:upload-asset'
  scenarioCancelJob: 'scenario:cancel-job'
  scenarioListJobs: 'scenario:list-jobs'
  scenarioUsageReport: 'scenario:usage-report'
  scenarioUsageEvents: 'scenario:usage-events'

  workflowsSearch: 'workflows:search'
  workflowsDescribe: 'workflows:describe'
  workflowsRun: 'workflows:run'

  projectCreate: 'project:create'
  projectOpen: 'project:open'
  projectCurrent: 'project:current'

  dialogPickPath: 'dialog:pick-path'
  dialogExportPicture: 'dialog:export-picture'

  documentList: 'document:list'
  documentRead: 'document:read'
  documentWrite: 'document:write'
  documentRemove: 'document:remove'
  documentConfirmClose: 'document:confirm-close'
  documentConfirmDelete: 'document:confirm-delete'

  assetsSearch: 'assets:search'
  assetsCounts: 'assets:counts'
  assetsPeaks: 'assets:peaks'
  assetsReveal: 'assets:reveal'
  assetsSaveAudio: 'assets:save-audio'
  assetsUpdate: 'assets:update'
  assetsRemove: 'assets:remove'
  assetsDescribe: 'assets:describe'

  cloudBrowse: 'cloud:browse'
  cloudPull: 'cloud:pull'
  cloudPush: 'cloud:push'
  cloudPlan: 'cloud:plan'

  favoritesList: 'favorites:list'
  favoritesPin: 'favorites:pin'
  favoritesUnpin: 'favorites:unpin'

  activityRead: 'activity:read'

  mediaIngest: 'media:ingest'
  mediaCancel: 'media:cancel'
  mediaAvailable: 'media:available'

  sceneExport: 'scene:export'

  fontsList: 'fonts:list'
  fontsRead: 'fonts:read'

  diagnosticsReport: 'diagnostics:report'

  windowToggleFullScreen: 'window:toggle-full-screen'
  windowState: 'window:state'
  windowWorkspace: 'window:workspace'

  updateState: 'update:state'
  updateInstall: 'update:install'
}

/**
 * Single source of channel names. Outside `shared/`, only `src/preload/` and `src/main/`
 * reference them; no component ever quotes a channel string — see spec § 4.
 */
export const CHANNELS: Channels = {
  settingsRead: 'settings:read',
  settingsWrite: 'settings:write',
  settingsAuthState: 'settings:auth-state',
  settingsOpen: 'settings:open',
  settingsRunAction: 'settings:run-action',
  settingsPending: 'settings:pending',

  accountsList: 'accounts:list',
  accountsAdd: 'accounts:add',
  accountsRename: 'accounts:rename',
  accountsRemove: 'accounts:remove',
  accountsActivate: 'accounts:activate',

  scenarioSearchModels: 'scenario:search-models',
  scenarioModelPreviews: 'scenario:model-previews',
  scenarioDescribeModel: 'scenario:describe-model',
  scenarioSuggestPrompts: 'scenario:suggest-prompts',
  scenarioTranslatePrompt: 'scenario:translate-prompt',
  scenarioDescribeStyle: 'scenario:describe-style',
  scenarioGenerate: 'scenario:generate',
  scenarioEstimateCost: 'scenario:estimate-cost',
  scenarioUploadAsset: 'scenario:upload-asset',
  scenarioCancelJob: 'scenario:cancel-job',
  scenarioListJobs: 'scenario:list-jobs',
  scenarioUsageReport: 'scenario:usage-report',
  scenarioUsageEvents: 'scenario:usage-events',

  workflowsSearch: 'workflows:search',
  workflowsDescribe: 'workflows:describe',
  workflowsRun: 'workflows:run',

  projectCreate: 'project:create',
  projectOpen: 'project:open',
  projectCurrent: 'project:current',

  dialogPickPath: 'dialog:pick-path',
  dialogExportPicture: 'dialog:export-picture',

  documentList: 'document:list',
  documentRead: 'document:read',
  documentWrite: 'document:write',
  documentRemove: 'document:remove',
  documentConfirmClose: 'document:confirm-close',
  documentConfirmDelete: 'document:confirm-delete',

  assetsSearch: 'assets:search',
  assetsCounts: 'assets:counts',
  assetsPeaks: 'assets:peaks',
  assetsReveal: 'assets:reveal',
  assetsSaveAudio: 'assets:save-audio',
  assetsUpdate: 'assets:update',
  assetsRemove: 'assets:remove',
  assetsDescribe: 'assets:describe',

  cloudBrowse: 'cloud:browse',
  cloudPull: 'cloud:pull',
  cloudPush: 'cloud:push',
  cloudPlan: 'cloud:plan',

  favoritesList: 'favorites:list',
  favoritesPin: 'favorites:pin',
  favoritesUnpin: 'favorites:unpin',

  activityRead: 'activity:read',

  mediaIngest: 'media:ingest',
  mediaCancel: 'media:cancel',
  mediaAvailable: 'media:available',

  sceneExport: 'scene:export',

  fontsList: 'fonts:list',
  fontsRead: 'fonts:read',

  diagnosticsReport: 'diagnostics:report',

  windowToggleFullScreen: 'window:toggle-full-screen',
  windowState: 'window:state',
  windowWorkspace: 'window:workspace',

  updateState: 'update:state',
  updateInstall: 'update:install',
}

/** An edited take on its way back to disk — see `StudioBridge['assets']['saveAudio']`. */
export type SaveAudioRequest = {
  /** The asset to overwrite. Absent creates a new one instead. */
  replaces?: string
  name: string
  /** The take this one was edited from, so the two stay traceable to each other. */
  derivedFrom?: string
  /** 16-bit PCM WAV, encoded by the renderer that decoded it. */
  wav: Uint8Array
}

/** A scene on its way to a file the studio will never look at again. */
export type SceneExportRequest = {
  /** Suggested file name, without its extension — the format decides that. */
  name: string
  format: ExportFormat
  /** Already encoded by the renderer: three.js's exporters run where the scene lives. */
  data: Uint8Array
}

export type LogLevel = 'info' | 'warn' | 'error'

export const LOG_LEVELS: readonly LogLevel[] = ['info', 'warn', 'error']

/**
 * Where in the renderer a failure was born. An inventory rather than free text: it is what a
 * reader greps for, and a typo in a string nobody reads back is a line that never surfaces.
 * The main process checks a report against this very list — see `registerDiagnosticsHandlers`.
 */
export type LogScope =
  | 'scene.model'
  | 'scene.texture'
  | 'scene.export'
  | 'texture.map'
  | 'texture.channel'
  | 'texture.shader'
  | 'skybox.source'
  | 'canvas.layer'
  | 'image.export'
  | 'document.load'
  | 'document.save'
  | 'document.close'
  | 'document.delete'
  | 'assets.reveal'
  | 'assets.open'
  | 'font.face'

export const LOG_SCOPES: readonly LogScope[] = [
  'scene.model',
  'scene.texture',
  'scene.export',
  'texture.map',
  'texture.channel',
  'texture.shader',
  'skybox.source',
  'canvas.layer',
  'image.export',
  'document.load',
  'document.save',
  'document.close',
  'document.delete',
  'assets.reveal',
  'assets.open',
  'font.face',
]

/** `LogEntry.scope` is a free string — the main process logs under its own names too. */
export function isLogScope(value: unknown): value is LogScope {
  return LOG_SCOPES.some(candidate => candidate === value)
}

/**
 * Long enough for a stack trace, short enough that a renderer looping on a failure cannot fill
 * the terminal. Applied on both sides: by the sender so the boundary carries no more than it
 * has to, by the main process because the sandboxed side is trusted for nothing.
 */
export const MAX_LOG_MESSAGE = 4000

/**
 * A logged line, travelling either way.
 *
 * Towards the renderer, it is what the main process wants visible in devtools: the API calls
 * leave from the main process, so they never show up in the renderer's Network tab, and without
 * this mirror the terminal the app was launched from is the only place to watch them.
 *
 * Towards the main process, it is a failure the renderer has no other way to record — the log
 * belongs to the main process, and a `console.error` in a component would leave nothing behind
 * in a packaged build. The scope is prefixed on arrival, so a line always says which side it
 * came from.
 */
export type LogEntry = {
  level: LogLevel
  scope: string
  message: string
}

/** Channels pushed from the main process to the renderer. */
export const EVENTS = {
  jobProgress: 'evt:job-progress',
  jobsChanged: 'evt:jobs-changed',
  mediaProgress: 'evt:media-progress',
  log: 'evt:log',
  projectChanged: 'evt:project-changed',
  settingsChanged: 'evt:settings-changed',
  accountsChanged: 'evt:accounts-changed',
  openTool: 'evt:open-tool',
  menuCommand: 'evt:menu-command',
  windowState: 'evt:window-state',
  sceneAdd: 'evt:scene-add',
  sceneExport: 'evt:scene-export',
  settingsSection: 'evt:settings-section',
  updateState: 'evt:update-state',
  activity: 'evt:activity',
}

export type Unsubscribe = () => void

/** Request to open a tool, coming from the native menu. */
export type ToolRequest = {
  zone: ToolZone
  tool: ToolId
}

/** Request to drop a node in the active scene, coming from the native menu. */
export type SceneAddRequest = { kind: MeshKind | LightKind | ObjectKind }

/** What the native menu asks of the scene in front: a format, and how much of the scene. */
export type SceneExportCommand = { format: ExportFormat; scope: 'scene' | 'selection' }

/**
 * What `window.studio` exposes. Every method that asks something maps to exactly one channel in
 * `CHANNELS`; every `on…` subscribes to exactly one entry of `EVENTS`.
 */
export type StudioBridge = {
  settings: {
    read: () => Promise<Settings>
    write: (partial: PartialSettings) => Promise<Settings>
    authState: () => Promise<AuthState>
    /** Opens the settings window on a section, or focuses it there if it is already up. */
    open: (section: SettingsSectionId) => Promise<void>
    /**
     * Runs one of the buttons of the settings window. A single channel rather than one per
     * action: they differ only by which id is named, and the main process is what decides
     * whether a given one is allowed to do anything.
     */
    runAction: (id: SettingActionId) => Promise<void>
    /**
     * Whether the settings window holds changes nobody has applied. Told to the main process
     * because closing a window is its decision, and it has no other way to know.
     */
    setPending: (pending: boolean) => Promise<void>
    /**
     * Settings are owned by the main process and replicated by every window. Without this, a
     * theme changed in the settings window would only reach the studio on the next launch.
     */
    onChange: (callback: (settings: Settings) => void) => Unsubscribe
    /** Section the settings window is asked to show while it is already open. */
    onSection: (callback: (section: SettingsSectionId) => void) => Unsubscribe
  }
  /**
   * The stored API keys. An API key carries its own project and team — the API lists neither —
   * so switching accounts is the only way to change which library the studio reads. The local
   * project is untouched by any of it: it is the user's disk.
   */
  accounts: {
    list: () => Promise<AccountSummary[]>
    /** Stores a key under a name. The name is required and must not already be taken. */
    add: (name: string, key: string, secret: string) => Promise<AccountsResult>
    rename: (id: string, name: string) => Promise<AccountsResult>
    remove: (id: string) => Promise<AccountsResult>
    activate: (id: string) => Promise<AccountsResult>
    /** Every window follows the switch: the account is owned by the main process. */
    onChange: (callback: (accounts: AccountSummary[]) => void) => Unsubscribe
  }
  scenario: {
    searchModels: (query?: ModelQuery) => Promise<ModelPage>
    /** Signed picture URL per asset id, absent for the ones the API has nothing for. */
    modelPreviews: (assetIds: readonly string[]) => Promise<Record<string, string>>
    describeModel: (modelId: string) => Promise<ModelDescriptor>
    /**
     * Rewrites a draft into on-model prompts, each with the settings the API proposes for it.
     * Free — measured at 0 creative units — and answered in one round trip: the endpoint hands
     * back a job, but its result is in the response, so nothing here is polled.
     */
    suggestPrompts: (request: SuggestPromptsRequest) => Promise<PromptSuggestion[]>
    /**
     * Carries a draft into the language the models are trained in, and says what it recognized
     * it as. Replaces the text rather than proposing beside it — nothing is invented here.
     */
    translatePrompt: (draft: string) => Promise<PromptTranslation>
    /** Reads the style of the reference pictures, so a prompt can be written from it. */
    describeStyle: (images: readonly string[]) => Promise<PromptStyle>
    generate: (modelId: string, body: Record<string, unknown>) => Promise<Job>
    /**
     * What running that exact form would cost, without running it — a model or a workflow, the
     * target says which. `null` when the API declines to price it; a rejection when the call
     * itself failed, which a caller may treat as no figure.
     */
    estimateCost: (target: JobTarget, body: Record<string, unknown>) => Promise<CostEstimate>
    /** A picture, base64, up to 6 MB. Returns the id of the asset the API kept. */
    uploadAsset: (name: string, image: string) => Promise<string>
    cancelJob: (jobId: string) => Promise<void>
    listJobs: () => Promise<Job[]>
    onProgress: (callback: (progress: JobProgress) => void) => Unsubscribe
    /**
     * The whole list, sent when it gains or loses an entry rather than when one of them moves.
     *
     * A progress event names a job by id, so a replica can only merge it into one it already
     * holds: a job picked up from a previous session, and one that left the session because its
     * project is no longer open, are both invisible to `onProgress` by construction.
     */
    onJobsChanged: (callback: (jobs: Job[]) => void) => Unsubscribe
    /**
     * What every stored account spent over the period — consumption only, never a balance: the
     * API exposes no such thing. Accounts are queried together and a refused key is reported in
     * `silent` rather than failing the call, since a revoked key is the ordinary case.
     */
    usageReport: (period: UsagePeriod) => Promise<UsageReport>
    /**
     * The raw billable events, paged: the one section large enough to slow the window down.
     *
     * Cursors are opaque — hand back the ones the previous page returned, `{}` for the first.
     */
    usageEvents: (period: UsagePeriod, cursors: UsageCursors) => Promise<UsageEventPage>
  }
  /**
   * Scenario's workflows, and the public ones — the Apps — above all: ready-made pipelines
   * anyone may run. A workflow is run through the same job manager a generation goes through,
   * so it lands in the jobs bar and its outputs in the project like everything else.
   */
  workflows: {
    /** One page of the listing, `public` unless the query says otherwise. */
    search: (query?: WorkflowQuery) => Promise<WorkflowPage>
    /** Its inputs, translated into the very fields a model's form is built from. */
    describe: (workflowId: string) => Promise<WorkflowDescriptor>
    run: (workflowId: string, body: Record<string, unknown>) => Promise<Job>
  }
  project: {
    create: (path: string, name: string) => Promise<Project>
    open: (path: string) => Promise<Project>
    current: () => Promise<Project | null>
    onChange: (callback: (project: Project | null) => void) => Unsubscribe
  }
  dialog: {
    /**
     * A native picker, answering the chosen path or null when it was cancelled. One channel for
     * every path the interface asks for — where a project goes, where ffmpeg lives — because
     * they differ only by which picker opens.
     */
    pickPath: (kind: PathKind, startIn?: string) => Promise<string | null>
    /**
     * Asks where to put a picture and writes it there. Base64 in, path out — the renderer has
     * no filesystem, and the bytes are what it has.
     */
    exportPicture: (name: string, image: string) => Promise<string | null>
  }
  documents: {
    /** Every document the open project holds, read off its folder — the one source of truth. */
    list: () => Promise<DocumentDescriptor[]>
    /** `null` when nothing has been saved under that id yet. */
    read: (id: string, kind: DocumentKind) => Promise<DocumentFile | null>
    /** The envelope — version, kind, timestamp — is stamped by the main process, not here. */
    write: (id: string, kind: DocumentKind, draft: DocumentDraft) => Promise<void>
    remove: (id: string, kind: DocumentKind) => Promise<void>
    /**
     * What to do with a modified document being closed. Native rather than drawn in the window:
     * this is the OS convention every desktop application answers with, and the wording lives
     * beside the menu's — the renderer asks the question, it does not phrase it.
     */
    confirmClose: (title: string) => Promise<CloseChoice>
    /** Whether the document's file really goes. Destructive, so the safe answer is the default. */
    confirmDelete: (title: string) => Promise<boolean>
  }
  assets: {
    search: (query: AssetQuery) => Promise<Asset[]>
    /**
     * How many assets of each kind the project holds — counted in SQL, so the answer is six
     * numbers rather than the catalogue itself.
     */
    counts: () => Promise<AssetCounts>
    /**
     * The waveform computed at ingest, as min/max pairs at `PEAKS_PER_SECOND`. Null when the
     * asset carries no sound, or when ffmpeg was missing when it was brought in.
     */
    peaks: (assetId: string) => Promise<Float32Array | null>
    /**
     * Shows the asset's file in the OS file manager — the errand the path itself never crosses
     * this boundary for, see `withoutSourcePath`. False when there was no file to show.
     */
    reveal: (assetId: string) => Promise<boolean>
    /** Writes an edited take back: over its source when `replaces` is set, beside it otherwise. */
    saveAudio: (request: SaveAudioRequest) => Promise<Asset>
    /** Renames an asset or rewrites its tags. Whichever field is absent is left as it was. */
    update: (assetId: string, changes: AssetChanges) => Promise<Asset>
    /**
     * Drops assets from the project, and from the library too when asked.
     *
     * `alsoRemote` is not undone by anything: the API has no single-asset delete and no undo,
     * so the confirmation belongs to whoever calls this.
     */
    remove: (assetIds: readonly string[], alsoRemote: boolean) => Promise<void>
    /**
     * Names the chosen pictures from what the API sees in them, and answers how many it named.
     *
     * Only pictures the library already knows can be described — captioning takes an asset id —
     * so a selection of local-only files is answered with zero rather than an error.
     */
    describe: (assetIds: readonly string[]) => Promise<number>
  }
  /**
   * The account's library, which is not the project's catalogue.
   *
   * Kept apart on purpose: `catalog.db` belongs to a project, while the library belongs to the
   * key. Mirroring one into the other would copy the same library into every project and leave
   * as many stale copies to invalidate — so cloud assets are read through, and only become rows
   * once they are pulled.
   */
  cloud: {
    /** One page of the library. The cursor is opaque, and null once there is no more. */
    browse: (query: CloudQuery) => Promise<CloudPage>
    /**
     * Brings assets into the project, bytes and all. Answers what each one did — a download
     * that fails halfway has already written the ones before it, and a rejection would lose
     * that. The rows themselves arrive through the catalogue, which the store re-reads.
     */
    pull: (remoteAssetIds: readonly string[]) => Promise<SyncOutcome[]>
    /** Sends local assets up. Answers what each one did, successes and failures alike. */
    push: (assetIds: readonly string[]) => Promise<SyncOutcome[]>
    /** What a push or a pull would do, before it costs a single request. */
    plan: (assetIds: readonly string[], policy: SyncPolicy) => Promise<SyncPlan>
  }
  /** Recipes worth keeping, held outside every project — see `domain/favorite.ts`. */
  favorites: {
    list: () => Promise<FavoriteRecipe[]>
    /**
     * Pins what produced an asset of the open project. Answers the whole list, so a window never
     * has to guess where the new one landed. An asset nobody generated has no recipe to keep,
     * and the list comes back unchanged.
     */
    pin: (assetId: string) => Promise<FavoriteRecipe[]>
    unpin: (id: string) => Promise<FavoriteRecipe[]>
  }
  /**
   * What the studio did, and what it failed to do — the surface it had none of.
   *
   * A line carries an i18n KEY and its parameters, never a sentence: the journal outlives the
   * language the interface was in when it was written. `detail` is `describeFailure` output and
   * nothing else, because an SDK message embeds the request, hence the API key.
   */
  activity: {
    read: (query: ActivityQuery) => Promise<ActivityEntry[]>
    /**
     * Lines as they are written, in batches. A push of two hundred assets is one message, not
     * two hundred — the same coalescing the ingest bar does with its progress.
     */
    onEntries: (callback: (entries: readonly ActivityEntry[]) => void) => Unsubscribe
  }
  scene: {
    /**
     * Writes an exported scene wherever the save dialog lands. Answers the file name it was
     * written under, or `null` when the dialog was dismissed — the name, never the path: where
     * a file sits is the main process's business, exactly as for an asset.
     */
    export: (request: SceneExportRequest) => Promise<string | null>
  }
  /**
   * The typefaces the machine has installed. The studio's own three are not here: they ship
   * inside it, and `EMBEDDED_FONTS` names them without anyone having to ask.
   */
  fonts: {
    /** Every installed family, sorted, one cut each — see `system-fonts`. */
    list: () => Promise<string[]>
    /**
     * A face's outlines, as a font file the renderer can parse. `null` when the machine no
     * longer has that family, which is the missing-font hole a shared document opens.
     */
    read: (family: string) => Promise<Uint8Array | null>
  }
  media: {
    /**
     * Opens the native picker and links what was chosen — the file is never copied, so a
     * twenty-minute rush costs a catalogue row. Resolves once the assets exist, while their
     * ingest runs on and reports through `onProgress`.
     */
    ingest: () => Promise<Asset[]>
    cancel: (assetId: string) => Promise<void>
    capabilities: () => Promise<MediaCapabilities>
    onProgress: (callback: (progress: IngestProgress) => void) => Unsubscribe
  }
  window: {
    toggleFullScreen: () => Promise<void>
    state: () => Promise<WindowState>
    onState: (callback: (state: WindowState) => void) => Unsubscribe
    /**
     * Tells the main process which workspace is up and which panels it can currently open, so
     * the menu can follow both. The panels travel with it because the main process cannot
     * work them out: whether the generator exists depends on a model being chosen.
     */
    setWorkspace: (workspace: WorkspaceId, tools: readonly ToolId[]) => Promise<void>
  }
  menu: {
    onOpenTool: (callback: (request: ToolRequest) => void) => Unsubscribe
    onCommand: (callback: (command: CommandId) => void) => Unsubscribe
    onSceneAdd: (callback: (request: SceneAddRequest) => void) => Unsubscribe
    onSceneExport: (callback: (command: SceneExportCommand) => void) => Unsubscribe
  }
  diagnostics: {
    onLog: (callback: (entry: LogEntry) => void) => Unsubscribe
    /**
     * The other direction: a failure born in the renderer, recorded by the process that owns the
     * log. Fire and forget — nothing decides anything on the answer, and a caller that awaited it
     * would make reporting a failure cost a round trip.
     */
    report: (entry: LogEntry) => Promise<void>
  }
  updates: {
    /**
     * The state as it stands. A window opened after the download finished would otherwise show
     * nothing until the next event, and there is no next event once an update is ready.
     */
    state: () => Promise<UpdateState>
    /**
     * Quits and installs. Only does anything once the state is `ready`; the update is applied
     * on the next quit regardless, so this is the shortcut, never the only way.
     */
    install: () => Promise<void>
    onState: (callback: (state: UpdateState) => void) => Unsubscribe
  }
}

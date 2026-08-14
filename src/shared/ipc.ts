import type { AccountSummary, AccountsResult } from './domain/account'
import type { ActivityEntry, ActivityQuery } from './domain/activity'
import type { Asset, AssetChanges, AssetCounts, AssetQuery } from './domain/asset'
import type { FavoriteRecipe } from './domain/favorite'
import type { FolderEntry } from './domain/folder'
import type { MaterialStyle } from './domain/style'
import type { CloudAsset, CloudPage, CloudQuery, ExploreQuery } from './domain/cloud-asset'
import type { CommandId, MenuCheck } from './domain/command'
import type { ContextMenuItem } from './domain/context-menu'
import type { SttEvent, SttSnapshot } from './domain/dictation'
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
import type { PlanAccess } from './domain/plan'
import type { Project } from './domain/project'
import type {
  PromptStyle,
  PromptSuggestion,
  PromptTranslation,
  SuggestPromptsRequest,
} from './domain/prompt-assist'
import type {
  DisplayMode,
  ExportFormat,
  LightKind,
  MeshKind,
  ObjectKind,
  ViewDirection,
} from './domain/scene'
import type { TextureExportTarget } from './domain/texture-export'
import type { Language } from './i18n/languages'
import type { AuthState, PartialSettings, Settings, SettingsSectionId } from './domain/settings'
import type { PathKind, SettingActionId } from './domain/settings-registry'
import type { SyncOutcome, SyncPlan, SyncPolicy } from './domain/sync'
import type { PbrChannel } from './domain/texture'
import type { ToolId, ToolSurface, ToolZone } from './domain/tool'
import type { UpdateState } from './domain/update'
import type { UsageCursors, UsageEventPage, UsagePeriod, UsageReport } from './domain/usage'
import type { WindowState } from './domain/window'

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
  scenarioPlan: 'scenario:plan'
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

  projectCreate: 'project:create'
  projectOpen: 'project:open'
  projectCurrent: 'project:current'
  projectListFolder: 'project:list-folder'
  projectOpenFile: 'project:open-file'
  projectRevealFile: 'project:reveal-file'
  projectRevealFolder: 'project:reveal-folder'
  projectRename: 'project:rename'
  projectRenameFile: 'project:rename-file'
  projectMoveFile: 'project:move-file'
  projectTrashFile: 'project:trash-file'

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
  assetsAbsent: 'assets:absent'
  assetsSaveAudio: 'assets:save-audio'
  assetsSavePicture: 'assets:save-picture'
  assetsSaveTexture: 'assets:save-texture'
  assetsExtractTextures: 'assets:extract-textures'
  assetsUpdate: 'assets:update'
  assetsRemove: 'assets:remove'
  assetsDescribe: 'assets:describe'

  cloudBrowse: 'cloud:browse'
  cloudExplore: 'cloud:explore'
  cloudSimilar: 'cloud:similar'
  cloudPull: 'cloud:pull'
  cloudPush: 'cloud:push'
  cloudPlan: 'cloud:plan'

  favoritesList: 'favorites:list'
  favoritesPin: 'favorites:pin'
  favoritesUnpin: 'favorites:unpin'

  stylesList: 'styles:list'
  stylesSave: 'styles:save'
  stylesRename: 'styles:rename'
  stylesRemove: 'styles:remove'

  activityRead: 'activity:read'

  mediaIngest: 'media:ingest'
  mediaCancel: 'media:cancel'
  mediaAvailable: 'media:available'

  dictationState: 'dictation:state'
  dictationStart: 'dictation:start'
  dictationStop: 'dictation:stop'
  dictationCancel: 'dictation:cancel'
  dictationPush: 'dictation:push'
  dictationDownloadModel: 'dictation:download-model'
  dictationCancelDownload: 'dictation:cancel-download'
  dictationOpenPrivacy: 'dictation:open-privacy'

  sceneExport: 'scene:export'
  renderStart: 'render:start'
  renderFrame: 'render:frame'
  renderFinish: 'render:finish'
  renderCancel: 'render:cancel'

  textureExport: 'texture:export'
  skyboxExport: 'skybox:export'

  fontsList: 'fonts:list'
  fontsRead: 'fonts:read'

  diagnosticsReport: 'diagnostics:report'

  windowToggleFullScreen: 'window:toggle-full-screen'
  windowState: 'window:state'
  windowLanguage: 'window:language'
  windowWorkspace: 'window:workspace'

  menuPopup: 'menu:popup'

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
  scenarioPlan: 'scenario:plan',
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

  projectCreate: 'project:create',
  projectOpen: 'project:open',
  projectCurrent: 'project:current',
  projectListFolder: 'project:list-folder',
  projectOpenFile: 'project:open-file',
  projectRevealFile: 'project:reveal-file',
  projectRevealFolder: 'project:reveal-folder',
  projectRename: 'project:rename',
  projectRenameFile: 'project:rename-file',
  projectMoveFile: 'project:move-file',
  projectTrashFile: 'project:trash-file',

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
  assetsAbsent: 'assets:absent',
  assetsSaveAudio: 'assets:save-audio',
  assetsSavePicture: 'assets:save-picture',
  assetsSaveTexture: 'assets:save-texture',
  assetsExtractTextures: 'assets:extract-textures',
  assetsUpdate: 'assets:update',
  assetsRemove: 'assets:remove',
  assetsDescribe: 'assets:describe',

  cloudBrowse: 'cloud:browse',
  cloudExplore: 'cloud:explore',
  cloudSimilar: 'cloud:similar',
  cloudPull: 'cloud:pull',
  cloudPush: 'cloud:push',
  cloudPlan: 'cloud:plan',

  favoritesList: 'favorites:list',
  favoritesPin: 'favorites:pin',
  favoritesUnpin: 'favorites:unpin',

  stylesList: 'styles:list',
  stylesSave: 'styles:save',
  stylesRename: 'styles:rename',
  stylesRemove: 'styles:remove',

  activityRead: 'activity:read',

  mediaIngest: 'media:ingest',
  mediaCancel: 'media:cancel',
  mediaAvailable: 'media:available',

  dictationState: 'dictation:state',
  dictationStart: 'dictation:start',
  dictationStop: 'dictation:stop',
  dictationCancel: 'dictation:cancel',
  dictationPush: 'dictation:push',
  dictationDownloadModel: 'dictation:download-model',
  dictationCancelDownload: 'dictation:cancel-download',
  dictationOpenPrivacy: 'dictation:open-privacy',

  sceneExport: 'scene:export',
  renderStart: 'render:start',
  renderFrame: 'render:frame',
  renderFinish: 'render:finish',
  renderCancel: 'render:cancel',

  textureExport: 'texture:export',
  skyboxExport: 'skybox:export',

  fontsList: 'fonts:list',
  fontsRead: 'fonts:read',

  diagnosticsReport: 'diagnostics:report',

  windowToggleFullScreen: 'window:toggle-full-screen',
  windowState: 'window:state',
  windowLanguage: 'window:language',
  windowWorkspace: 'window:workspace',

  menuPopup: 'menu:popup',

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

/**
 * An edited picture on its way back to disk — see `StudioBridge['assets']['savePicture']`.
 *
 * `png` is base64 where its two neighbours carry `Uint8Array`, and the reason is written where
 * the same pixels leave for an export: a `Buffer` does not cross the bridge, and base64 is what
 * the extraction already produced (`main/window/dialogs.ts`). `extract.base64` hands back a
 * string, `derive` hands back bytes; each sends what it holds rather than paying for a
 * conversion — which on a 4K picture is megabytes copied twice for nothing.
 */
export type SavePictureRequest = {
  /** The asset to overwrite, keeping its id and its place in the shelf. Absent creates one. */
  replaces?: string
  name: string
  /** The picture this one was edited from, so the two stay traceable to each other. */
  derivedFrom?: string
  /** PNG payload, base64 and never a data URL — the prefix is part of the picture otherwise. */
  png: string
}

/**
 * A channel the renderer computed, on its way into the project — see
 * `StudioBridge['assets']['saveTexture']`.
 *
 * `map` is required, and that is what keeps the channel honest: it says which of the eight
 * these pixels ARE, the shelf badges it, and the catalogue can then answer "which normal maps
 * does this project hold". Bytes with no channel are an ordinary picture and belong elsewhere.
 */
export type SaveTextureRequest = {
  name: string
  map: PbrChannel
  /** The channel asset they were computed from, so the two stay traceable to each other. */
  derivedFrom?: string
  /** PNG, encoded by the renderer that drew it. */
  png: Uint8Array
}

/** A scene on its way to a file the studio will never look at again. */
/** What a render is asked for, before a single frame is computed. */
export type RenderStartRequest = {
  /** Suggested file name, without its extension. */
  name: string
  /** Frames per second of the film, which is also the rate the stills are declared at. */
  fps: number
}

/** One computed frame, on its way to the staging folder. */
export type RenderFrameRequest = {
  /** The session it belongs to, as `render.start` answered it. */
  id: string
  /** Its place in the film. The order of the calls decides nothing. */
  index: number
  /** Already encoded by the renderer: the GPU lives where the scene does. */
  png: Uint8Array
}

export type SceneExportRequest = {
  /** Suggested file name, without its extension — the format decides that. */
  name: string
  format: ExportFormat
  /** Already encoded by the renderer: three.js's exporters run where the scene lives. */
  data: Uint8Array
}

/** One file of an export, already encoded by the renderer that drew it. */
export type ExportedFile = {
  /** No separator and no extension: it is joined to a folder this process chose. */
  name: string
  /** Carried rather than derived: a target writes `.png`s, and one of them writes a `.glb`. */
  extension: string
  bytes: Uint8Array
}

/**
 * Several files on their way to a folder. Unlike a scene, this kind of export means nothing
 * file by file — a base colour without the ORM beside it is half a material, and five faces of
 * a sky are not a sky — so the dialog asks for a folder and they land in one named after them.
 *
 * Shared by the texture and the skybox rather than written twice: the two differ in what they
 * draw, never in what "write these together" means.
 */
export type FolderExportRequest = {
  /** The folder to create inside the chosen one, named after what is being exported. */
  folder: string
  files: readonly ExportedFile[]
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
  | 'scene.bvh'
  | 'scene.texture'
  | 'scene.export'
  | 'scene.render'
  | 'texture.map'
  | 'texture.channel'
  | 'texture.seam'
  | 'texture.shader'
  | 'texture.export'
  | 'skybox.source'
  | 'skybox.export'
  | 'canvas.layer'
  // Not `assets.open`, and the split is the point: the document DOES open here, and the code
  // carries on building it. What is reported is that it could not take the size of the picture
  // behind it — which matters because ⌘S writes the document's size back over that picture.
  // Said under `assets.open`, it read « this asset has nowhere to go » while the asset was
  // appearing on screen.
  | 'canvas.size'
  | 'image.export'
  | 'document.load'
  | 'document.save'
  | 'document.close'
  | 'document.delete'
  | 'assets.reveal'
  | 'assets.open'
  // ⌘S reaches the asset behind a document as well as the document itself, and the two halves
  // fail apart: the file can be written while the picture behind it is not.
  | 'assets.save'
  // ⇧⌘S makes a COPY and never rewrites anything, so its failures cannot be read as a save that
  // did not happen. One of them fires once the copy is already on disk — under `assets.save` the
  // journal denied a write that had just succeeded.
  | 'assets.copy'
  | 'assets.extract'
  // The home's shelf: a folder moved since it was last opened is the ordinary case there, so
  // all three of its gestures need somewhere to say they did nothing.
  | 'project.reveal'
  | 'project.forget'
  | 'project.rename'
  | 'font.face'
  // Not a document's: a render that threw and a stored layout React refused belong to the shell
  // holding the documents, and both used to leave nothing behind in a packaged build.
  | 'shell.render'
  | 'shell.layout'
  // A menu the system refused to draw. It leaves nothing on screen to look at — no surface, no
  // half-open flyout — so a right-click that does nothing at all is the only symptom there is.
  | 'shell.menu'

export const LOG_SCOPES: readonly LogScope[] = [
  'scene.model',
  'scene.bvh',
  'scene.texture',
  'scene.export',
  'scene.render',
  'texture.map',
  'texture.channel',
  'texture.seam',
  'texture.shader',
  'texture.export',
  'skybox.source',
  'skybox.export',
  'canvas.layer',
  'canvas.size',
  'image.export',
  'document.load',
  'document.save',
  'document.close',
  'document.delete',
  'assets.reveal',
  'assets.open',
  'assets.save',
  'assets.copy',
  'assets.extract',
  'project.reveal',
  'project.forget',
  'project.rename',
  'font.face',
  'shell.render',
  'shell.layout',
  'shell.menu',
]

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
  dictation: 'evt:dictation',
  log: 'evt:log',
  projectChanged: 'evt:project-changed',
  projectFolderChanged: 'evt:project-folder-changed',
  assetsChanged: 'evt:assets-changed',
  settingsChanged: 'evt:settings-changed',
  accountsChanged: 'evt:accounts-changed',
  openTool: 'evt:open-tool',
  menuCommand: 'evt:menu-command',
  windowState: 'evt:window-state',
  windowLanguage: 'evt:window-language',
  sceneAdd: 'evt:scene-add',
  sceneView: 'evt:scene-view',
  sceneDisplay: 'evt:scene-display',
  sceneExport: 'evt:scene-export',
  textureExport: 'evt:texture-export',
  skyboxExport: 'evt:skybox-export',
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

/** Which of the six sides the menu asks the scene in front to look from. */
export type SceneViewRequest = { direction: ViewDirection }

/** Which of the seven ways of drawing the menu asks the scene in front to switch to. */
export type SceneDisplayRequest = { mode: DisplayMode }

/** What the native menu asks of the scene in front: a format, and how much of the scene. */
export type SceneExportCommand = { format: ExportFormat; scope: 'scene' | 'selection' }

/** What the native menu asks of the texture in front: which engine it is being handed to. */
export type TextureExportCommand = { target: TextureExportTarget }

/**
 * What the native menu asks of the sky in front: how large each of the six faces comes out.
 *
 * A size where a texture takes a target, because a sky has no per-engine recipe to choose from —
 * six PNGs named `_Rt`…`_Bk` is what all of them read. What differs is what the machine can
 * hold, and that is a number.
 */
export type SkyboxExportCommand = { size: number }

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
     * The account's plan, against which a model's `requiredPlanLevel` is read. `null` when it
     * cannot be read — the picker then offers everything, as it did before it asked.
     */
    plan: () => Promise<PlanAccess | null>
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
     * What running that exact form would cost, without running it. `null` when the API declines
     * to price it; a rejection when the call itself failed, which a caller may treat as no
     * figure.
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
  project: {
    create: (path: string, name: string) => Promise<Project>
    open: (path: string) => Promise<Project>
    current: () => Promise<Project | null>
    onChange: (callback: (project: Project | null) => void) => Unsubscribe
    /**
     * One level of the project folder, `''` being the root. The explorer walks it a folder at a
     * time: `assets/img` holds thousands of files in an ordinary project, and a reader who never
     * opens it must not pay for them.
     */
    listFolder: (relative: string) => Promise<FolderEntry[]>
    /**
     * Hands a file the studio cannot open to the system — a `.pdf` to its viewer. Answers
     * whether it was taken; a refusal is already in the journal, since a folder someone chose
     * is not a place to throw an exception from.
     */
    openFile: (relative: string) => Promise<boolean>
    /**
     * Something moved in the project folder. It does not say what: the panel re-reads the
     * folders it has open, which is cheaper than carrying a path through and never wrong.
     */
    onFolderChanged: (callback: () => void) => Unsubscribe
    /** Shows the file in the system's own file manager, so the path never leaves the process. */
    revealFile: (relative: string) => Promise<void>
    /**
     * Shows a project FOLDER, named by its own absolute path — the home's shelf points at
     * projects that are not open, and `revealFile` above can only name something inside the one
     * that is. The same path `open` already takes, and refused by the same parser.
     *
     * Answers whether the folder was there to show. `showItemInFolder` reports nothing and
     * no-ops on a path that has gone, and a folder moved since it was last opened is the
     * ordinary case for that shelf.
     */
    revealFolder: (path: string) => Promise<boolean>
    /**
     * Renames a PROJECT — the name in its manifest, never the folder on disk. Named by its own
     * absolute path, so the home's shelf can rename one it has not opened.
     *
     * The folder is deliberately left alone: `recentProjects`, `storage.lastProject` and every
     * absolute path the catalogue holds are keyed on it, and moving it would strand all three for
     * a display name. The manifest already allows the two to differ, which is exactly why
     * `RecentProject` stores the name instead of deriving it from the folder.
     *
     * Answers the project as it now reads. Throws when the folder will not open — a project
     * renamed out from under the studio is the same failure `open` reports.
     */
    rename: (path: string, name: string) => Promise<Project>
    /**
     * Renames in place — the name only, never the folder it sits in. Answers whether it
     * happened: a name already taken is refused rather than overwritten, and the studio's own
     * folders refuse to move at all.
     */
    renameFile: (relative: string, name: string) => Promise<boolean>
    /**
     * Into another folder, keeping its name — the drag in the tree. Answers whether it
     * happened: a name already taken there is refused rather than overwritten, and the studio's
     * own folders refuse on both sides, as neither what moves nor what receives.
     */
    moveFile: (relative: string, folder: string) => Promise<boolean>
    /**
     * To the system's trash, never deleted. Answers whether the system took it. The studio does
     * not erase anything in a folder that belongs to someone else.
     */
    trashFile: (relative: string) => Promise<boolean>
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
     * Says the catalogue was written by the MAIN process, with no window having asked — the
     * pictures a model sheds on import are the case this exists for. Every other write is
     * answered where it was ordered, and the shelf invalidates itself there.
     *
     * No payload: what changed is a query away, and a window that was told « these six rows »
     * would still have to ask for the ones it is scoped to.
     */
    onChanged: (callback: () => void) => Unsubscribe
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
    /**
     * Which of these assets no longer have the file the catalogue records — the ids, never the
     * paths, which do not cross this boundary (see `withoutSourcePath`).
     *
     * Asked of a handful at a time rather than of the whole catalogue: a project holds hundreds
     * of rows and only the cells on screen need an answer, so the shelf asks for what it draws.
     * A row with no file to begin with — one that lives only in the library — is never absent:
     * nothing was expected of it.
     */
    absent: (assetIds: readonly string[]) => Promise<string[]>
    /** Writes an edited take back: over its source when `replaces` is set, beside it otherwise. */
    saveAudio: (request: SaveAudioRequest) => Promise<Asset>
    /**
     * Puts an edited picture into the project, as a NEW asset beside the one it came from.
     *
     * Always a new one, like `saveTexture` and for a related reason: a document's base layer is
     * sourced from the asset it was opened from, so overwriting that asset would feed the
     * flattened stack back into the layer it was flattened from.
     *
     * The kind and the channel are the source's own, read from the catalogue — a texture channel
     * edited as a picture stays a channel, which keeps it on the right shelf.
     */
    savePicture: (request: SavePictureRequest) => Promise<Asset>
    /**
     * Puts a channel the renderer computed into the project.
     *
     * Always a new asset: a derivation is cheap to run again, and overwriting the file the
     * user pointed at would destroy pixels the studio did not author.
     */
    saveTexture: (request: SaveTextureRequest) => Promise<Asset>
    /**
     * Takes the pictures a `.glb` carries inside itself out into the project, one texture asset
     * each — which is what makes a downloaded model's own maps something the studio can open,
     * paint on, and hand back to a material.
     *
     * The bytes are copied, never decoded and re-encoded: what comes out is exactly what the
     * model was painted with. Each one is filed under the channel its glTF slot means, when the
     * slot means exactly one — `metallicRoughnessTexture` packs two and claims neither.
     *
     * Answers with what it created, newest last, and with an empty list for a model that carries
     * no picture at all. A picture already taken out is taken out again: the copy in the project
     * may have been painted since, and this is not the gesture that decides that.
     */
    extractTextures: (assetId: string) => Promise<Asset[]>
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
     * One page of what everyone published, of a single kind and newest first — the home's
     * explore feed, and the one read here that returns assets this account does not own.
     *
     * Anything the API flagged is left out. Nothing is pulled by looking: a tile of the feed
     * belongs to somebody else until it is fetched like a library one.
     */
    explore: (query: ExploreQuery) => Promise<CloudPage>
    /**
     * Published assets that resemble the one named, that one taken out of its own results.
     *
     * The reference is the caller's to choose: the home measures against the library's most
     * recent asset, and a right-click elsewhere would name the asset under the pointer.
     */
    similar: (assetId: string) => Promise<CloudAsset[]>
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
  /** Saved ways of reading a material, held outside every project — see `domain/style.ts`. */
  styles: {
    list: () => Promise<MaterialStyle[]>
    /**
     * Keeps the values handed over. Each of the four answers the whole list, as the favourites
     * do: one write, one truth back, and a window that never has to guess where a row landed.
     */
    save: (style: MaterialStyle) => Promise<MaterialStyle[]>
    rename: (id: string, name: string) => Promise<MaterialStyle[]>
    remove: (id: string) => Promise<MaterialStyle[]>
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
   * Rendering a scene to a film, in three steps: a session is opened once the save dialog has
   * answered, frames are staged one by one, and the encode happens at the end.
   *
   * Staged rather than piped, and asked for BEFORE anything is computed: a render is minutes of
   * work, and neither a broken pipe nor a dismissed dialog should throw all of it away.
   */
  render: {
    /** Answers the session id, or `null` when the save dialog was dismissed. */
    start: (request: RenderStartRequest) => Promise<string | null>
    frame: (request: RenderFrameRequest) => Promise<void>
    /** Encodes what was staged. Answers the file name, never the path. */
    finish: (id: string) => Promise<string | null>
    cancel: (id: string) => Promise<void>
  }
  texture: {
    /**
     * Writes an exported texture into a folder of its own, inside the one the dialog landed on.
     * Answers the folder's name, or `null` when the dialog was dismissed — the name, never the
     * path, exactly as a scene answers.
     */
    export: (request: FolderExportRequest) => Promise<string | null>
  }
  skybox: {
    /** The six faces of a sky, same bargain as a texture's folder — and the same writer. */
    export: (request: FolderExportRequest) => Promise<string | null>
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
  dictation: {
    /** The state as it stands, for a window that arrives after the events it missed. */
    state: () => Promise<SttSnapshot>
    /**
     * Opens a session: asks the operating system for the microphone, loads the engine if it is
     * not resident, and starts accepting audio. Resolves once the answer is known — which may
     * be `permissionRequired` or `modelMissing` rather than success.
     */
    start: () => Promise<void>
    /** Closes the segment in flight, so the last words are transcribed rather than dropped. */
    stop: () => Promise<void>
    /** Drops the segment in flight. What was said is not transcribed and not inserted. */
    cancel: () => Promise<void>
    /**
     * One chunk of 16-bit PCM at 16 kHz. Fire and forget, like `diagnostics.report`: nothing
     * decides on the answer, and awaiting one would put a round trip on every 100 ms of speech.
     */
    push: (chunk: ArrayBuffer) => Promise<void>
    downloadModel: () => Promise<void>
    cancelDownload: () => Promise<void>
    /**
     * Opens the operating system's microphone privacy screen. Takes no address: a renderer that
     * could name what gets opened would be a renderer that can open anything.
     */
    openPrivacySettings: () => Promise<void>
    onEvent: (callback: (event: SttEvent) => void) => Unsubscribe
  }
  window: {
    toggleFullScreen: () => Promise<void>
    state: () => Promise<WindowState>
    onState: (callback: (state: WindowState) => void) => Unsubscribe
    /**
     * The language this window draws in. Resolved by the main process and asked for rather than
     * worked out here, because the setting may say `'system'` and only that side sees what the
     * machine really prefers: the list this side can read starts with Chromium's UI locale,
     * which answers `en-US` for every system language Chromium ships no bundle for.
     *
     * The same value the native menu was built with, which is the point — an English menu above
     * a French window reads as a bug.
     */
    language: () => Promise<Language>
    onLanguage: (callback: (language: Language) => void) => Unsubscribe
    /**
     * Tells the main process which surface is up, which panels it can currently open, and
     * which menu rows are ticked, so the menu can follow all three. None of them can be worked
     * out on the other side: whether the generator exists depends on a model being chosen, and
     * whether a scene is drawn in wireframe is a fact of the document in front.
     *
     * The surface, not the workspace: the home covers the space behind it, and a menu built on
     * that space offered the image tools over a screen that edits no image.
     */
    setWorkspace: (
      surface: ToolSurface,
      tools: readonly ToolId[],
      checked: readonly MenuCheck[],
    ) => Promise<void>
  }
  menu: {
    /**
     * Draws these rows as a native context menu over the calling window, and answers the `id` of
     * the row that was chosen — `null` when the menu was dismissed.
     *
     * The window builds the rows because it is the only side that knows them: the labels come
     * from its own bundle, and `enabled` from state no other process replicates. What it does
     * NOT decide is where the menu appears — the system pops it at the pointer, which is the
     * whole reason for going through here rather than drawing a surface.
     */
    popup: (items: readonly ContextMenuItem[]) => Promise<string | null>
    onOpenTool: (callback: (request: ToolRequest) => void) => Unsubscribe
    onCommand: (callback: (command: CommandId) => void) => Unsubscribe
    onSceneAdd: (callback: (request: SceneAddRequest) => void) => Unsubscribe
    onSceneView: (callback: (request: SceneViewRequest) => void) => Unsubscribe
    onSceneDisplay: (callback: (request: SceneDisplayRequest) => void) => Unsubscribe
    onSceneExport: (callback: (command: SceneExportCommand) => void) => Unsubscribe
    onTextureExport: (callback: (command: TextureExportCommand) => void) => Unsubscribe
    onSkyboxExport: (callback: (command: SkyboxExportCommand) => void) => Unsubscribe
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

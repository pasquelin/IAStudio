import type { AccountSummary, AccountsResult } from './domain/account'
import type { Asset, AssetQuery } from './domain/asset'
import type { CommandId } from './domain/command'
import type {
  DocumentDescriptor,
  DocumentDraft,
  DocumentFile,
  DocumentKind,
} from './domain/document'
import type { Job, JobProgress } from './domain/job'
import type { IngestProgress, MediaCapabilities } from './domain/media'
import type { ModelDescriptor, ModelPage, ModelQuery } from './domain/model'
import type { Project } from './domain/project'
import type { LightKind, MeshKind } from './domain/scene'
import type { AuthState, PartialSettings, Settings, SettingsSectionId } from './domain/settings'
import type { PathKind, SettingActionId } from './domain/settings-registry'
import type { ToolId, ToolZone } from './domain/tool'
import type { WindowState } from './domain/window'
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
  scenarioGenerate: 'scenario:generate'
  scenarioUploadAsset: 'scenario:upload-asset'
  scenarioCancelJob: 'scenario:cancel-job'
  scenarioListJobs: 'scenario:list-jobs'

  projectCreate: 'project:create'
  projectOpen: 'project:open'
  projectCurrent: 'project:current'

  dialogPickPath: 'dialog:pick-path'

  documentList: 'document:list'
  documentRead: 'document:read'
  documentWrite: 'document:write'
  documentRemove: 'document:remove'

  assetsSearch: 'assets:search'
  assetsPeaks: 'assets:peaks'
  assetsReveal: 'assets:reveal'
  assetsSaveAudio: 'assets:save-audio'

  mediaIngest: 'media:ingest'
  mediaCancel: 'media:cancel'
  mediaAvailable: 'media:available'

  windowToggleFullScreen: 'window:toggle-full-screen'
  windowState: 'window:state'
  windowWorkspace: 'window:workspace'
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
  scenarioGenerate: 'scenario:generate',
  scenarioUploadAsset: 'scenario:upload-asset',
  scenarioCancelJob: 'scenario:cancel-job',
  scenarioListJobs: 'scenario:list-jobs',

  projectCreate: 'project:create',
  projectOpen: 'project:open',
  projectCurrent: 'project:current',

  dialogPickPath: 'dialog:pick-path',

  documentList: 'document:list',
  documentRead: 'document:read',
  documentWrite: 'document:write',
  documentRemove: 'document:remove',

  assetsSearch: 'assets:search',
  assetsPeaks: 'assets:peaks',
  assetsReveal: 'assets:reveal',
  assetsSaveAudio: 'assets:save-audio',

  mediaIngest: 'media:ingest',
  mediaCancel: 'media:cancel',
  mediaAvailable: 'media:available',

  windowToggleFullScreen: 'window:toggle-full-screen',
  windowState: 'window:state',
  windowWorkspace: 'window:workspace',
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

export type LogLevel = 'info' | 'warn' | 'error'

/**
 * A line the main process wants visible in the renderer's console. The API calls leave from
 * the main process, so they never show up in the renderer's Network tab; without this mirror
 * the only place to watch them is the terminal the app was launched from.
 */
export type LogEntry = {
  level: LogLevel
  scope: string
  message: string
}

/** Channels pushed from the main process to the renderer. */
export const EVENTS = {
  jobProgress: 'evt:job-progress',
  mediaProgress: 'evt:media-progress',
  log: 'evt:log',
  projectChanged: 'evt:project-changed',
  settingsChanged: 'evt:settings-changed',
  accountsChanged: 'evt:accounts-changed',
  openTool: 'evt:open-tool',
  menuCommand: 'evt:menu-command',
  windowState: 'evt:window-state',
  sceneAdd: 'evt:scene-add',
  settingsSection: 'evt:settings-section',
}

export type Unsubscribe = () => void

/** Request to open a tool, coming from the native menu. */
export type ToolRequest = {
  zone: ToolZone
  tool: ToolId
}

/** Request to drop a node in the active scene, coming from the native menu. */
export type SceneAddRequest = { kind: MeshKind | LightKind }

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
    generate: (modelId: string, body: Record<string, unknown>) => Promise<Job>
    /** A picture, base64, up to 6 MB. Returns the id of the asset the API kept. */
    uploadAsset: (name: string, image: string) => Promise<string>
    cancelJob: (jobId: string) => Promise<void>
    listJobs: () => Promise<Job[]>
    onProgress: (callback: (progress: JobProgress) => void) => Unsubscribe
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
  }
  documents: {
    /** Every document the open project holds, read off its folder — the one source of truth. */
    list: () => Promise<DocumentDescriptor[]>
    /** `null` when nothing has been saved under that id yet. */
    read: (id: string, kind: DocumentKind) => Promise<DocumentFile | null>
    /** The envelope — version, kind, timestamp — is stamped by the main process, not here. */
    write: (id: string, kind: DocumentKind, draft: DocumentDraft) => Promise<void>
    remove: (id: string, kind: DocumentKind) => Promise<void>
  }
  assets: {
    search: (query: AssetQuery) => Promise<Asset[]>
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
  }
  diagnostics: {
    onLog: (callback: (entry: LogEntry) => void) => Unsubscribe
  }
}

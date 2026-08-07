import type { Asset, AssetQuery } from './domain/asset'
import type { Job, JobProgress } from './domain/job'
import type { ModelDescriptor, ModelPage, ModelQuery } from './domain/model'
import type { Project } from './domain/project'
import type { LightKind, MeshKind } from './domain/scene'
import type { AuthState, PartialSettings, Settings } from './domain/settings'
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
  settingsSetCredentials: 'settings:set-credentials'
  settingsAuthState: 'settings:auth-state'
  settingsForgetCredentials: 'settings:forget-credentials'

  scenarioSearchModels: 'scenario:search-models'
  scenarioModelPreviews: 'scenario:model-previews'
  scenarioDescribeModel: 'scenario:describe-model'
  scenarioGenerate: 'scenario:generate'
  scenarioCancelJob: 'scenario:cancel-job'
  scenarioListJobs: 'scenario:list-jobs'

  projectCreate: 'project:create'
  projectOpen: 'project:open'
  projectCurrent: 'project:current'
  projectPickFolder: 'project:pick-folder'

  assetsSearch: 'assets:search'
  assetsPeaks: 'assets:peaks'
  assetsSaveAudio: 'assets:save-audio'

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
  settingsSetCredentials: 'settings:set-credentials',
  settingsAuthState: 'settings:auth-state',
  settingsForgetCredentials: 'settings:forget-credentials',

  scenarioSearchModels: 'scenario:search-models',
  scenarioModelPreviews: 'scenario:model-previews',
  scenarioDescribeModel: 'scenario:describe-model',
  scenarioGenerate: 'scenario:generate',
  scenarioCancelJob: 'scenario:cancel-job',
  scenarioListJobs: 'scenario:list-jobs',

  projectCreate: 'project:create',
  projectOpen: 'project:open',
  projectCurrent: 'project:current',
  projectPickFolder: 'project:pick-folder',

  assetsSearch: 'assets:search',
  assetsPeaks: 'assets:peaks',
  assetsSaveAudio: 'assets:save-audio',

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
  log: 'evt:log',
  projectChanged: 'evt:project-changed',
  openTool: 'evt:open-tool',
  menuCommand: 'evt:menu-command',
  windowState: 'evt:window-state',
  sceneAdd: 'evt:scene-add',
}

export type Unsubscribe = () => void

/** Request to open a tool, coming from the native menu. */
export type ToolRequest = {
  zone: ToolZone
  tool: ToolId
}

/** Native menu commands with no payload, identified by a verb. */
export type MenuCommand = 'project:new' | 'project:open' | 'layout:reset'

/** Request to drop a node in the active scene, coming from the native menu. */
export type SceneAddRequest = { kind: MeshKind | LightKind }

/** What `window.studio` exposes. Every method maps to exactly one channel in `CHANNELS`. */
export type StudioBridge = {
  settings: {
    read: () => Promise<Settings>
    write: (partial: PartialSettings) => Promise<Settings>
    setCredentials: (key: string, secret: string) => Promise<AuthState>
    authState: () => Promise<AuthState>
    forgetCredentials: () => Promise<void>
  }
  scenario: {
    searchModels: (query?: ModelQuery) => Promise<ModelPage>
    /** Signed picture URL per asset id, absent for the ones the API has nothing for. */
    modelPreviews: (assetIds: readonly string[]) => Promise<Record<string, string>>
    describeModel: (modelId: string) => Promise<ModelDescriptor>
    generate: (modelId: string, body: Record<string, unknown>) => Promise<Job>
    cancelJob: (jobId: string) => Promise<void>
    listJobs: () => Promise<Job[]>
    onProgress: (callback: (progress: JobProgress) => void) => Unsubscribe
  }
  project: {
    create: (path: string, name: string) => Promise<Project>
    open: (path: string) => Promise<Project>
    current: () => Promise<Project | null>
    pickFolder: () => Promise<string | null>
    onChange: (callback: (project: Project | null) => void) => Unsubscribe
  }
  assets: {
    search: (query: AssetQuery) => Promise<Asset[]>
    /**
     * The waveform computed at ingest, as min/max pairs at `PEAKS_PER_SECOND`. Null when the
     * asset carries no sound, or when ffmpeg was missing when it was brought in.
     */
    peaks: (assetId: string) => Promise<Float32Array | null>
    /** Writes an edited take back: over its source when `replaces` is set, beside it otherwise. */
    saveAudio: (request: SaveAudioRequest) => Promise<Asset>
  }
  window: {
    toggleFullScreen: () => Promise<void>
    state: () => Promise<WindowState>
    onState: (callback: (state: WindowState) => void) => Unsubscribe
    /** Tells the main process which workspace is up, so the menu can follow it. */
    setWorkspace: (workspace: WorkspaceId) => Promise<void>
  }
  menu: {
    onOpenTool: (callback: (request: ToolRequest) => void) => Unsubscribe
    onCommand: (callback: (command: MenuCommand) => void) => Unsubscribe
    onSceneAdd: (callback: (request: SceneAddRequest) => void) => Unsubscribe
  }
  diagnostics: {
    onLog: (callback: (entry: LogEntry) => void) => Unsubscribe
  }
}

import type { Asset, AssetQuery } from './domain/asset'
import type { Job, JobProgress } from './domain/job'
import type { ModelDescriptor, ModelFamily, ModelSummary } from './domain/model'
import type { Project } from './domain/project'
import type { AuthState, PartialSettings, Settings } from './domain/settings'
import type { ToolId, ToolZone } from './domain/tool'
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
  settingsSetCredentials: 'settings:set-credentials'
  settingsAuthState: 'settings:auth-state'
  settingsForgetCredentials: 'settings:forget-credentials'

  scenarioListModels: 'scenario:list-models'
  scenarioDescribeModel: 'scenario:describe-model'
  scenarioGenerate: 'scenario:generate'
  scenarioCancelJob: 'scenario:cancel-job'
  scenarioListJobs: 'scenario:list-jobs'

  projectCreate: 'project:create'
  projectOpen: 'project:open'
  projectCurrent: 'project:current'
  projectPickFolder: 'project:pick-folder'

  assetsSearch: 'assets:search'

  windowToggleFullScreen: 'window:toggle-full-screen'
  windowState: 'window:state'
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

  scenarioListModels: 'scenario:list-models',
  scenarioDescribeModel: 'scenario:describe-model',
  scenarioGenerate: 'scenario:generate',
  scenarioCancelJob: 'scenario:cancel-job',
  scenarioListJobs: 'scenario:list-jobs',

  projectCreate: 'project:create',
  projectOpen: 'project:open',
  projectCurrent: 'project:current',
  projectPickFolder: 'project:pick-folder',

  assetsSearch: 'assets:search',

  windowToggleFullScreen: 'window:toggle-full-screen',
  windowState: 'window:state',
}

/** Channels pushed from the main process to the renderer. */
export const EVENTS = {
  jobProgress: 'evt:job-progress',
  projectChanged: 'evt:project-changed',
  openTool: 'evt:open-tool',
  menuCommand: 'evt:menu-command',
  windowState: 'evt:window-state',
}

export type Unsubscribe = () => void

/** Request to open a tool, coming from the native menu. */
export type ToolRequest = {
  zone: ToolZone
  tool: ToolId
}

/** Native menu commands with no payload, identified by a verb. */
export type MenuCommand = 'project:new' | 'project:open' | 'layout:reset'

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
    listModels: (family?: ModelFamily) => Promise<ModelSummary[]>
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
  }
  window: {
    toggleFullScreen: () => Promise<void>
    state: () => Promise<WindowState>
    onState: (callback: (state: WindowState) => void) => Unsubscribe
  }
  menu: {
    onOpenTool: (callback: (request: ToolRequest) => void) => Unsubscribe
    onCommand: (callback: (command: MenuCommand) => void) => Unsubscribe
  }
}

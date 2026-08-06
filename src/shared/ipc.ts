import type { Asset, AssetQuery } from './domain/asset'
import type { Job, JobProgress } from './domain/job'
import type { ModelDescriptor, ModelFamily, ModelSummary } from './domain/model'
import type { Project } from './domain/project'
import type { AuthState, PartialSettings, Settings } from './domain/settings'
import type { WindowState } from './domain/window'

/**
 * Source unique des noms de canaux. Seul `src/preload/` les cite : un composant qui
 * écrirait `ipcRenderer.invoke('...')` contournerait le contrat — cf. spec § 4.
 */
export const CHANNELS = {
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
  assetsUrl: 'assets:url',

  windowToggleFullScreen: 'window:toggle-full-screen',
  windowState: 'window:state',
}

/** Canaux poussés par le main vers le renderer. */
export const EVENTS = {
  jobProgress: 'evt:job-progress',
  projectChanged: 'evt:project-changed',
  openTool: 'evt:open-tool',
  menuCommand: 'evt:menu-command',
  windowState: 'evt:window-state',
}

export type Unsubscribe = () => void

/** Demande d'ouverture d'un outil venue du menu natif. */
export type ToolRequest = {
  zone: string
  tool: string
}

/** Commandes du menu natif sans charge utile, identifiées par un verbe. */
export type MenuCommand = 'project:new' | 'project:open' | 'layout:reset'

/** Ce que `window.studio` expose. Chaque méthode a exactement un canal dans `CHANNELS`. */
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
    url: (assetId: string) => Promise<string | null>
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

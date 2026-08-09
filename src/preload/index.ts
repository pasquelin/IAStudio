import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { AccountSummary } from '@shared/domain/account'
import type { ActivityEntry } from '@shared/domain/activity'
import type { CommandId } from '@shared/domain/command'
import type { Project } from '@shared/domain/project'
import type { Job, JobProgress } from '@shared/domain/job'
import type { IngestProgress } from '@shared/domain/media'
import type { Settings } from '@shared/domain/settings'
import type { UpdateState } from '@shared/domain/update'
import type { WindowState } from '@shared/domain/window'
import type { SettingsSectionId } from '@shared/domain/settings'
import {
  CHANNELS,
  EVENTS,
  type LogEntry,
  type SceneAddRequest,
  type SceneExportCommand,
  type StudioBridge,
  type ToolRequest,
  type Unsubscribe,
} from '@shared/ipc'

function subscribe<T>(channel: string, callback: (payload: T) => void): Unsubscribe {
  const listener = (_event: IpcRendererEvent, payload: T): void => callback(payload)
  ipcRenderer.on(channel, listener)
  return () => {
    ipcRenderer.removeListener(channel, listener)
  }
}

const bridge: StudioBridge = {
  settings: {
    read: () => ipcRenderer.invoke(CHANNELS.settingsRead),
    write: partial => ipcRenderer.invoke(CHANNELS.settingsWrite, partial),
    authState: () => ipcRenderer.invoke(CHANNELS.settingsAuthState),
    open: section => ipcRenderer.invoke(CHANNELS.settingsOpen, section),
    runAction: id => ipcRenderer.invoke(CHANNELS.settingsRunAction, id),
    setPending: pending => ipcRenderer.invoke(CHANNELS.settingsPending, pending),
    onChange: callback => subscribe<Settings>(EVENTS.settingsChanged, callback),
    onSection: callback => subscribe<SettingsSectionId>(EVENTS.settingsSection, callback),
  },
  accounts: {
    list: () => ipcRenderer.invoke(CHANNELS.accountsList),
    add: (name, key, secret) => ipcRenderer.invoke(CHANNELS.accountsAdd, name, key, secret),
    rename: (id, name) => ipcRenderer.invoke(CHANNELS.accountsRename, id, name),
    remove: id => ipcRenderer.invoke(CHANNELS.accountsRemove, id),
    activate: id => ipcRenderer.invoke(CHANNELS.accountsActivate, id),
    onChange: callback => subscribe<AccountSummary[]>(EVENTS.accountsChanged, callback),
  },
  scenario: {
    searchModels: query => ipcRenderer.invoke(CHANNELS.scenarioSearchModels, query),
    modelPreviews: assetIds => ipcRenderer.invoke(CHANNELS.scenarioModelPreviews, assetIds),
    describeModel: modelId => ipcRenderer.invoke(CHANNELS.scenarioDescribeModel, modelId),
    suggestPrompts: request => ipcRenderer.invoke(CHANNELS.scenarioSuggestPrompts, request),
    translatePrompt: draft => ipcRenderer.invoke(CHANNELS.scenarioTranslatePrompt, draft),
    describeStyle: images => ipcRenderer.invoke(CHANNELS.scenarioDescribeStyle, images),
    generate: (modelId, body) => ipcRenderer.invoke(CHANNELS.scenarioGenerate, modelId, body),
    estimateCost: (modelId, body) =>
      ipcRenderer.invoke(CHANNELS.scenarioEstimateCost, modelId, body),
    uploadAsset: (name, image) => ipcRenderer.invoke(CHANNELS.scenarioUploadAsset, name, image),
    cancelJob: jobId => ipcRenderer.invoke(CHANNELS.scenarioCancelJob, jobId),
    listJobs: () => ipcRenderer.invoke(CHANNELS.scenarioListJobs),
    onProgress: callback => subscribe<JobProgress>(EVENTS.jobProgress, callback),
    onJobsChanged: callback => subscribe<Job[]>(EVENTS.jobsChanged, callback),
    usageReport: period => ipcRenderer.invoke(CHANNELS.scenarioUsageReport, period),
    usageEvents: (period, cursors) =>
      ipcRenderer.invoke(CHANNELS.scenarioUsageEvents, period, cursors),
  },
  project: {
    create: (path, name) => ipcRenderer.invoke(CHANNELS.projectCreate, path, name),
    open: path => ipcRenderer.invoke(CHANNELS.projectOpen, path),
    current: () => ipcRenderer.invoke(CHANNELS.projectCurrent),
    onChange: callback => subscribe<Project | null>(EVENTS.projectChanged, callback),
  },
  dialog: {
    pickPath: (kind, startIn) => ipcRenderer.invoke(CHANNELS.dialogPickPath, kind, startIn),
    exportPicture: (name, image) => ipcRenderer.invoke(CHANNELS.dialogExportPicture, name, image),
  },
  documents: {
    list: () => ipcRenderer.invoke(CHANNELS.documentList),
    read: (id, kind) => ipcRenderer.invoke(CHANNELS.documentRead, id, kind),
    write: (id, kind, file) => ipcRenderer.invoke(CHANNELS.documentWrite, id, kind, file),
    remove: (id, kind) => ipcRenderer.invoke(CHANNELS.documentRemove, id, kind),
    confirmClose: title => ipcRenderer.invoke(CHANNELS.documentConfirmClose, title),
    confirmDelete: title => ipcRenderer.invoke(CHANNELS.documentConfirmDelete, title),
  },
  assets: {
    search: query => ipcRenderer.invoke(CHANNELS.assetsSearch, query),
    counts: () => ipcRenderer.invoke(CHANNELS.assetsCounts),
    peaks: assetId => ipcRenderer.invoke(CHANNELS.assetsPeaks, assetId),
    reveal: assetId => ipcRenderer.invoke(CHANNELS.assetsReveal, assetId),
    saveAudio: request => ipcRenderer.invoke(CHANNELS.assetsSaveAudio, request),
    update: (assetId, changes) => ipcRenderer.invoke(CHANNELS.assetsUpdate, assetId, changes),
    remove: (assetIds, alsoRemote) =>
      ipcRenderer.invoke(CHANNELS.assetsRemove, assetIds, alsoRemote),
    describe: assetIds => ipcRenderer.invoke(CHANNELS.assetsDescribe, assetIds),
  },
  cloud: {
    browse: query => ipcRenderer.invoke(CHANNELS.cloudBrowse, query),
    pull: remoteAssetIds => ipcRenderer.invoke(CHANNELS.cloudPull, remoteAssetIds),
    push: assetIds => ipcRenderer.invoke(CHANNELS.cloudPush, assetIds),
    plan: (assetIds, policy) => ipcRenderer.invoke(CHANNELS.cloudPlan, assetIds, policy),
  },
  activity: {
    read: query => ipcRenderer.invoke(CHANNELS.activityRead, query),
    onEntries: callback => subscribe<readonly ActivityEntry[]>(EVENTS.activity, callback),
  },
  scene: {
    export: request => ipcRenderer.invoke(CHANNELS.sceneExport, request),
  },
  fonts: {
    list: () => ipcRenderer.invoke(CHANNELS.fontsList),
    read: family => ipcRenderer.invoke(CHANNELS.fontsRead, family),
  },
  media: {
    ingest: () => ipcRenderer.invoke(CHANNELS.mediaIngest),
    cancel: assetId => ipcRenderer.invoke(CHANNELS.mediaCancel, assetId),
    capabilities: () => ipcRenderer.invoke(CHANNELS.mediaAvailable),
    onProgress: callback => subscribe<IngestProgress>(EVENTS.mediaProgress, callback),
  },
  window: {
    toggleFullScreen: () => ipcRenderer.invoke(CHANNELS.windowToggleFullScreen),
    state: () => ipcRenderer.invoke(CHANNELS.windowState),
    onState: callback => subscribe<WindowState>(EVENTS.windowState, callback),
    setWorkspace: (workspace, tools) =>
      ipcRenderer.invoke(CHANNELS.windowWorkspace, workspace, tools),
  },
  menu: {
    onOpenTool: callback => subscribe<ToolRequest>(EVENTS.openTool, callback),
    onCommand: callback => subscribe<CommandId>(EVENTS.menuCommand, callback),
    onSceneAdd: callback => subscribe<SceneAddRequest>(EVENTS.sceneAdd, callback),
    onSceneExport: callback => subscribe<SceneExportCommand>(EVENTS.sceneExport, callback),
  },
  diagnostics: {
    onLog: callback => subscribe<LogEntry>(EVENTS.log, callback),
    report: entry => ipcRenderer.invoke(CHANNELS.diagnosticsReport, entry),
  },
  updates: {
    state: () => ipcRenderer.invoke(CHANNELS.updateState),
    install: () => ipcRenderer.invoke(CHANNELS.updateInstall),
    onState: callback => subscribe<UpdateState>(EVENTS.updateState, callback),
  },
}

contextBridge.exposeInMainWorld('studio', bridge)

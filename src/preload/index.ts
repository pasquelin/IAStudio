import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { AccountSummary } from '@shared/domain/account'
import type { CommandId } from '@shared/domain/command'
import type { Project } from '@shared/domain/project'
import type { JobProgress } from '@shared/domain/job'
import type { IngestProgress } from '@shared/domain/media'
import type { Settings } from '@shared/domain/settings'
import type { WindowState } from '@shared/domain/window'
import type { SettingsSectionId } from '@shared/domain/settings'
import {
  CHANNELS,
  EVENTS,
  type LogEntry,
  type SceneAddRequest,
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
    generate: (modelId, body) => ipcRenderer.invoke(CHANNELS.scenarioGenerate, modelId, body),
    uploadAsset: (name, image) => ipcRenderer.invoke(CHANNELS.scenarioUploadAsset, name, image),
    cancelJob: jobId => ipcRenderer.invoke(CHANNELS.scenarioCancelJob, jobId),
    listJobs: () => ipcRenderer.invoke(CHANNELS.scenarioListJobs),
    onProgress: callback => subscribe<JobProgress>(EVENTS.jobProgress, callback),
  },
  project: {
    create: (path, name) => ipcRenderer.invoke(CHANNELS.projectCreate, path, name),
    open: path => ipcRenderer.invoke(CHANNELS.projectOpen, path),
    current: () => ipcRenderer.invoke(CHANNELS.projectCurrent),
    onChange: callback => subscribe<Project | null>(EVENTS.projectChanged, callback),
  },
  dialog: {
    pickPath: (kind, startIn) => ipcRenderer.invoke(CHANNELS.dialogPickPath, kind, startIn),
  },
  documents: {
    list: () => ipcRenderer.invoke(CHANNELS.documentList),
    read: (id, kind) => ipcRenderer.invoke(CHANNELS.documentRead, id, kind),
    write: (id, kind, file) => ipcRenderer.invoke(CHANNELS.documentWrite, id, kind, file),
    remove: (id, kind) => ipcRenderer.invoke(CHANNELS.documentRemove, id, kind),
  },
  assets: {
    search: query => ipcRenderer.invoke(CHANNELS.assetsSearch, query),
    peaks: assetId => ipcRenderer.invoke(CHANNELS.assetsPeaks, assetId),
    reveal: assetId => ipcRenderer.invoke(CHANNELS.assetsReveal, assetId),
    saveAudio: request => ipcRenderer.invoke(CHANNELS.assetsSaveAudio, request),
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
  },
  diagnostics: {
    onLog: callback => subscribe<LogEntry>(EVENTS.log, callback),
  },
}

contextBridge.exposeInMainWorld('studio', bridge)

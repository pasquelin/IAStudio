import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { Project } from '@shared/domain/project'
import type { JobProgress } from '@shared/domain/job'
import type { IngestProgress } from '@shared/domain/media'
import type { WindowState } from '@shared/domain/window'
import type { SettingsSectionId } from '@shared/domain/settings'
import {
  CHANNELS,
  EVENTS,
  type LogEntry,
  type MenuCommand,
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
    setCredentials: (key, secret) =>
      ipcRenderer.invoke(CHANNELS.settingsSetCredentials, key, secret),
    authState: () => ipcRenderer.invoke(CHANNELS.settingsAuthState),
    forgetCredentials: () => ipcRenderer.invoke(CHANNELS.settingsForgetCredentials),
    open: section => ipcRenderer.invoke(CHANNELS.settingsOpen, section),
    onSection: callback => subscribe<SettingsSectionId>(EVENTS.settingsSection, callback),
  },
  scenario: {
    searchModels: query => ipcRenderer.invoke(CHANNELS.scenarioSearchModels, query),
    modelPreviews: assetIds => ipcRenderer.invoke(CHANNELS.scenarioModelPreviews, assetIds),
    describeModel: modelId => ipcRenderer.invoke(CHANNELS.scenarioDescribeModel, modelId),
    generate: (modelId, body) => ipcRenderer.invoke(CHANNELS.scenarioGenerate, modelId, body),
    cancelJob: jobId => ipcRenderer.invoke(CHANNELS.scenarioCancelJob, jobId),
    listJobs: () => ipcRenderer.invoke(CHANNELS.scenarioListJobs),
    onProgress: callback => subscribe<JobProgress>(EVENTS.jobProgress, callback),
  },
  project: {
    create: (path, name) => ipcRenderer.invoke(CHANNELS.projectCreate, path, name),
    open: path => ipcRenderer.invoke(CHANNELS.projectOpen, path),
    current: () => ipcRenderer.invoke(CHANNELS.projectCurrent),
    pickFolder: () => ipcRenderer.invoke(CHANNELS.projectPickFolder),
    onChange: callback => subscribe<Project | null>(EVENTS.projectChanged, callback),
  },
  assets: {
    search: query => ipcRenderer.invoke(CHANNELS.assetsSearch, query),
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
    setWorkspace: workspace => ipcRenderer.invoke(CHANNELS.windowWorkspace, workspace),
  },
  menu: {
    onOpenTool: callback => subscribe<ToolRequest>(EVENTS.openTool, callback),
    onCommand: callback => subscribe<MenuCommand>(EVENTS.menuCommand, callback),
    onSceneAdd: callback => subscribe<SceneAddRequest>(EVENTS.sceneAdd, callback),
  },
  diagnostics: {
    onLog: callback => subscribe<LogEntry>(EVENTS.log, callback),
  },
}

contextBridge.exposeInMainWorld('studio', bridge)

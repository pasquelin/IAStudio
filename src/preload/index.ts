import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { Project } from '@shared/domain/project'
import type { JobProgress } from '@shared/domain/job'
import type { WindowState } from '@shared/domain/window'
import {
  CHANNELS,
  EVENTS,
  type MenuCommand,
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
  },
  scenario: {
    listModels: family => ipcRenderer.invoke(CHANNELS.scenarioListModels, family),
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
  window: {
    toggleFullScreen: () => ipcRenderer.invoke(CHANNELS.windowToggleFullScreen),
    state: () => ipcRenderer.invoke(CHANNELS.windowState),
    onState: callback => subscribe<WindowState>(EVENTS.windowState, callback),
  },
  menu: {
    onOpenTool: callback => subscribe<ToolRequest>(EVENTS.openTool, callback),
    onCommand: callback => subscribe<MenuCommand>(EVENTS.menuCommand, callback),
  },
}

contextBridge.exposeInMainWorld('studio', bridge)

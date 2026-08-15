import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { AccountSummary } from '@shared/domain/account'
import type { ActivityEntry } from '@shared/domain/activity'
import type { CommandId } from '@shared/domain/command'
import type { SttEvent } from '@shared/domain/dictation'
import type { Project } from '@shared/domain/project'
import type { Job, JobProgress } from '@shared/domain/job'
import type { IngestProgress } from '@shared/domain/media'
import type { Settings } from '@shared/domain/settings'
import type { Language } from '@shared/i18n/languages'
import type { UpdateState } from '@shared/domain/update'
import type { WindowState } from '@shared/domain/window'
import type { SettingsSectionId } from '@shared/domain/settings'
import {
  CHANNELS,
  EVENTS,
  type AssistantActionRequest,
  type LogEntry,
  type SceneAddRequest,
  type SceneDisplayRequest,
  type SceneViewRequest,
  type SceneExportCommand,
  type SkyboxExportCommand,
  type TextureExportCommand,
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
    plan: () => ipcRenderer.invoke(CHANNELS.scenarioPlan),
    suggestPrompts: request => ipcRenderer.invoke(CHANNELS.scenarioSuggestPrompts, request),
    translatePrompt: draft => ipcRenderer.invoke(CHANNELS.scenarioTranslatePrompt, draft),
    describeStyle: images => ipcRenderer.invoke(CHANNELS.scenarioDescribeStyle, images),
    generate: (modelId, body) => ipcRenderer.invoke(CHANNELS.scenarioGenerate, modelId, body),
    estimateCost: (target, body) => ipcRenderer.invoke(CHANNELS.scenarioEstimateCost, target, body),
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
    listFolder: relative => ipcRenderer.invoke(CHANNELS.projectListFolder, relative),
    openFile: relative => ipcRenderer.invoke(CHANNELS.projectOpenFile, relative),
    onFolderChanged: callback => subscribe<void>(EVENTS.projectFolderChanged, callback),
    revealFile: relative => ipcRenderer.invoke(CHANNELS.projectRevealFile, relative),
    revealFolder: path => ipcRenderer.invoke(CHANNELS.projectRevealFolder, path),
    rename: (path, name) => ipcRenderer.invoke(CHANNELS.projectRename, path, name),
    renameFile: (relative, name) => ipcRenderer.invoke(CHANNELS.projectRenameFile, relative, name),
    moveFile: (relative, folder) => ipcRenderer.invoke(CHANNELS.projectMoveFile, relative, folder),
    trashFile: relative => ipcRenderer.invoke(CHANNELS.projectTrashFile, relative),
  },
  dialog: {
    pickPath: (kind, startIn) => ipcRenderer.invoke(CHANNELS.dialogPickPath, kind, startIn),
    exportPicture: (name, image) => ipcRenderer.invoke(CHANNELS.dialogExportPicture, name, image),
  },
  documents: {
    list: () => ipcRenderer.invoke(CHANNELS.documentList),
    read: (id, kind) => ipcRenderer.invoke(CHANNELS.documentRead, id, kind),
    write: (id, kind, file) => ipcRenderer.invoke(CHANNELS.documentWrite, id, kind, file),
    rename: (id, kind, title) => ipcRenderer.invoke(CHANNELS.documentRename, id, kind, title),
    remove: (id, kind) => ipcRenderer.invoke(CHANNELS.documentRemove, id, kind),
    confirmClose: title => ipcRenderer.invoke(CHANNELS.documentConfirmClose, title),
    confirmDelete: title => ipcRenderer.invoke(CHANNELS.documentConfirmDelete, title),
  },
  assets: {
    search: query => ipcRenderer.invoke(CHANNELS.assetsSearch, query),
    onChanged: callback => subscribe<void>(EVENTS.assetsChanged, callback),
    counts: () => ipcRenderer.invoke(CHANNELS.assetsCounts),
    peaks: assetId => ipcRenderer.invoke(CHANNELS.assetsPeaks, assetId),
    reveal: assetId => ipcRenderer.invoke(CHANNELS.assetsReveal, assetId),
    absent: assetIds => ipcRenderer.invoke(CHANNELS.assetsAbsent, assetIds),
    saveAudio: request => ipcRenderer.invoke(CHANNELS.assetsSaveAudio, request),
    savePicture: request => ipcRenderer.invoke(CHANNELS.assetsSavePicture, request),
    saveTexture: request => ipcRenderer.invoke(CHANNELS.assetsSaveTexture, request),
    extractTextures: assetId => ipcRenderer.invoke(CHANNELS.assetsExtractTextures, assetId),
    update: (assetId, changes) => ipcRenderer.invoke(CHANNELS.assetsUpdate, assetId, changes),
    remove: (assetIds, alsoRemote) =>
      ipcRenderer.invoke(CHANNELS.assetsRemove, assetIds, alsoRemote),
    describe: assetIds => ipcRenderer.invoke(CHANNELS.assetsDescribe, assetIds),
  },
  cloud: {
    browse: query => ipcRenderer.invoke(CHANNELS.cloudBrowse, query),
    explore: query => ipcRenderer.invoke(CHANNELS.cloudExplore, query),
    similar: assetId => ipcRenderer.invoke(CHANNELS.cloudSimilar, assetId),
    pull: remoteAssetIds => ipcRenderer.invoke(CHANNELS.cloudPull, remoteAssetIds),
    push: assetIds => ipcRenderer.invoke(CHANNELS.cloudPush, assetIds),
    plan: (assetIds, policy) => ipcRenderer.invoke(CHANNELS.cloudPlan, assetIds, policy),
  },
  favorites: {
    list: () => ipcRenderer.invoke(CHANNELS.favoritesList),
    pin: assetId => ipcRenderer.invoke(CHANNELS.favoritesPin, assetId),
    unpin: id => ipcRenderer.invoke(CHANNELS.favoritesUnpin, id),
  },
  styles: {
    list: () => ipcRenderer.invoke(CHANNELS.stylesList),
    save: style => ipcRenderer.invoke(CHANNELS.stylesSave, style),
    rename: (id, name) => ipcRenderer.invoke(CHANNELS.stylesRename, id, name),
    remove: id => ipcRenderer.invoke(CHANNELS.stylesRemove, id),
  },
  activity: {
    read: query => ipcRenderer.invoke(CHANNELS.activityRead, query),
    onEntries: callback => subscribe<readonly ActivityEntry[]>(EVENTS.activity, callback),
  },
  scene: {
    export: request => ipcRenderer.invoke(CHANNELS.sceneExport, request),
  },
  render: {
    start: request => ipcRenderer.invoke(CHANNELS.renderStart, request),
    frame: request => ipcRenderer.invoke(CHANNELS.renderFrame, request),
    finish: id => ipcRenderer.invoke(CHANNELS.renderFinish, id),
    cancel: id => ipcRenderer.invoke(CHANNELS.renderCancel, id),
  },
  texture: {
    export: request => ipcRenderer.invoke(CHANNELS.textureExport, request),
  },
  skybox: {
    export: request => ipcRenderer.invoke(CHANNELS.skyboxExport, request),
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
  assistant: {
    think: request => ipcRenderer.invoke(CHANNELS.assistantThink, request),
    onAction: callback => subscribe<AssistantActionRequest>(EVENTS.assistantAction, callback),
    actionResult: result => ipcRenderer.invoke(CHANNELS.assistantActionResult, result),
  },
  dictation: {
    state: () => ipcRenderer.invoke(CHANNELS.dictationState),
    start: () => ipcRenderer.invoke(CHANNELS.dictationStart),
    stop: () => ipcRenderer.invoke(CHANNELS.dictationStop),
    cancel: () => ipcRenderer.invoke(CHANNELS.dictationCancel),
    push: chunk => ipcRenderer.invoke(CHANNELS.dictationPush, chunk),
    downloadModel: () => ipcRenderer.invoke(CHANNELS.dictationDownloadModel),
    cancelDownload: () => ipcRenderer.invoke(CHANNELS.dictationCancelDownload),
    openPrivacySettings: () => ipcRenderer.invoke(CHANNELS.dictationOpenPrivacy),
    onEvent: callback => subscribe<SttEvent>(EVENTS.dictation, callback),
  },
  mirror: {
    open: () => ipcRenderer.invoke(CHANNELS.mirrorOpen),
  },
  window: {
    toggleFullScreen: () => ipcRenderer.invoke(CHANNELS.windowToggleFullScreen),
    state: () => ipcRenderer.invoke(CHANNELS.windowState),
    onState: callback => subscribe<WindowState>(EVENTS.windowState, callback),
    language: () => ipcRenderer.invoke(CHANNELS.windowLanguage),
    onLanguage: callback => subscribe<Language>(EVENTS.windowLanguage, callback),
    setWorkspace: (workspace, tools, checked) =>
      ipcRenderer.invoke(CHANNELS.windowWorkspace, workspace, tools, checked),
  },
  menu: {
    popup: items => ipcRenderer.invoke(CHANNELS.menuPopup, items),
    onOpenTool: callback => subscribe<ToolRequest>(EVENTS.openTool, callback),
    onCommand: callback => subscribe<CommandId>(EVENTS.menuCommand, callback),
    onSceneAdd: callback => subscribe<SceneAddRequest>(EVENTS.sceneAdd, callback),
    onSceneView: callback => subscribe<SceneViewRequest>(EVENTS.sceneView, callback),
    onSceneDisplay: callback => subscribe<SceneDisplayRequest>(EVENTS.sceneDisplay, callback),
    onSceneExport: callback => subscribe<SceneExportCommand>(EVENTS.sceneExport, callback),
    onTextureExport: callback => subscribe<TextureExportCommand>(EVENTS.textureExport, callback),
    onSkyboxExport: callback => subscribe<SkyboxExportCommand>(EVENTS.skyboxExport, callback),
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

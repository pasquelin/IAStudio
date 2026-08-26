import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { AccountSummary } from '@shared/domain/account'
import type { ActivityEntry } from '@shared/domain/activity'
import type { AiOverview } from '@shared/domain/aiOverview'
import type { Asset } from '@shared/domain/asset'
import type { CommandId } from '@shared/domain/command'
import type { TaskProgress } from '@shared/domain/taskProgress'
import type { SttEvent } from '@shared/domain/dictation'
import type { FileOutcome } from '@shared/domain/fileOp'
import type { Project, RescanState } from '@shared/domain/project'
import type { ContextState } from '@shared/domain/projectContext'
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
  type McpState,
  type SceneAddRequest,
  type SceneDisplayRequest,
  type SceneViewRequest,
  type SceneCaptureCommand,
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
  mcp: {
    state: () => ipcRenderer.invoke(CHANNELS.mcpState),
    onState: callback => subscribe<McpState>(EVENTS.mcpState, callback),
  },
  accounts: {
    list: () => ipcRenderer.invoke(CHANNELS.accountsList),
    add: (name, key, secret, providerId) =>
      ipcRenderer.invoke(CHANNELS.accountsAdd, name, key, secret, providerId),
    rename: (id, name) => ipcRenderer.invoke(CHANNELS.accountsRename, id, name),
    remove: id => ipcRenderer.invoke(CHANNELS.accountsRemove, id),
    activate: id => ipcRenderer.invoke(CHANNELS.accountsActivate, id),
    credits: () => ipcRenderer.invoke(CHANNELS.accountsCredits),
    onChange: callback => subscribe<AccountSummary[]>(EVENTS.accountsChanged, callback),
  },
  provider: {
    searchModels: query => ipcRenderer.invoke(CHANNELS.providerSearchModels, query),
    modelPreviews: assetIds => ipcRenderer.invoke(CHANNELS.providerModelPreviews, assetIds),
    describeModel: modelId => ipcRenderer.invoke(CHANNELS.providerDescribeModel, modelId),
    plan: () => ipcRenderer.invoke(CHANNELS.providerPlan),
    suggestPrompts: request => ipcRenderer.invoke(CHANNELS.providerSuggestPrompts, request),
    translatePrompt: draft => ipcRenderer.invoke(CHANNELS.providerTranslatePrompt, draft),
    describeStyle: images => ipcRenderer.invoke(CHANNELS.providerDescribeStyle, images),
    generate: (modelId, body, use) =>
      ipcRenderer.invoke(CHANNELS.providerGenerate, modelId, body, use),
    estimateCost: (target, body, use) =>
      ipcRenderer.invoke(CHANNELS.providerEstimateCost, target, body, use),
    uploadAsset: (name, image) => ipcRenderer.invoke(CHANNELS.providerUploadAsset, name, image),
    cancelJob: jobId => ipcRenderer.invoke(CHANNELS.providerCancelJob, jobId),
    listJobs: () => ipcRenderer.invoke(CHANNELS.providerListJobs),
    onProgress: callback => subscribe<JobProgress>(EVENTS.jobProgress, callback),
    onJobsChanged: callback => subscribe<Job[]>(EVENTS.jobsChanged, callback),
    usageReport: period => ipcRenderer.invoke(CHANNELS.providerUsageReport, period),
    usageEvents: (period, cursors) =>
      ipcRenderer.invoke(CHANNELS.providerUsageEvents, period, cursors),
  },
  project: {
    create: path => ipcRenderer.invoke(CHANNELS.projectCreate, path),
    open: path => ipcRenderer.invoke(CHANNELS.projectOpen, path),
    current: () => ipcRenderer.invoke(CHANNELS.projectCurrent),
    onChange: callback => subscribe<Project | null>(EVENTS.projectChanged, callback),
    listFolder: (relative, hidden) =>
      ipcRenderer.invoke(CHANNELS.projectListFolder, relative, hidden),
    searchFolder: (term, hidden) => ipcRenderer.invoke(CHANNELS.projectSearchFolder, term, hidden),
    walkFolder: hidden => ipcRenderer.invoke(CHANNELS.projectWalkFolder, hidden),
    openFile: relative => ipcRenderer.invoke(CHANNELS.projectOpenFile, relative),
    onFolderChanged: callback => subscribe<void>(EVENTS.projectFolderChanged, callback),
    onRescan: callback => subscribe<RescanState>(EVENTS.projectRescan, callback),
    rescanState: () => ipcRenderer.invoke(CHANNELS.projectRescanState),
    stopRescan: () => ipcRenderer.invoke(CHANNELS.projectStopRescan),
    fileFacts: relative => ipcRenderer.invoke(CHANNELS.projectFileFacts, relative),
    readContext: () => ipcRenderer.invoke(CHANNELS.projectReadContext),
    writeContext: cards => ipcRenderer.invoke(CHANNELS.projectWriteContext, cards),
    onContextChanged: callback => subscribe<ContextState>(EVENTS.projectContext, callback),
    exportInto: request => ipcRenderer.invoke(CHANNELS.projectExport, request),
    revealFile: relative => ipcRenderer.invoke(CHANNELS.projectRevealFile, relative),
    revealFolder: path => ipcRenderer.invoke(CHANNELS.projectRevealFolder, path),
    rename: (path, name) => ipcRenderer.invoke(CHANNELS.projectRename, path, name),
    renameFile: (relative, name) => ipcRenderer.invoke(CHANNELS.projectRenameFile, relative, name),
    moveFiles: (paths, folder) => ipcRenderer.invoke(CHANNELS.projectMoveFiles, paths, folder),
    trashFiles: paths => ipcRenderer.invoke(CHANNELS.projectTrashFiles, paths),
    newFolder: (folder, name) => ipcRenderer.invoke(CHANNELS.projectNewFolder, folder, name),
    duplicateFiles: paths => ipcRenderer.invoke(CHANNELS.projectDuplicateFiles, paths),
    pasteFiles: (paths, folder, cut) =>
      ipcRenderer.invoke(CHANNELS.projectPasteFiles, paths, folder, cut),
    undoFile: () => ipcRenderer.invoke(CHANNELS.projectUndoFile),
    redoFile: () => ipcRenderer.invoke(CHANNELS.projectRedoFile),
    fileHistory: () => ipcRenderer.invoke(CHANNELS.projectFileHistory),
    onFilesChanged: callback => subscribe<FileOutcome>(EVENTS.filesChanged, callback),
  },
  git: {
    read: () => ipcRenderer.invoke(CHANNELS.gitRead),
    init: () => ipcRenderer.invoke(CHANNELS.gitInit),
    stage: paths => ipcRenderer.invoke(CHANNELS.gitStage, paths),
    unstage: paths => ipcRenderer.invoke(CHANNELS.gitUnstage, paths),
    restore: paths => ipcRenderer.invoke(CHANNELS.gitRestore, paths),
    commit: (message, amend) => ipcRenderer.invoke(CHANNELS.gitCommit, message, amend),
    branches: () => ipcRenderer.invoke(CHANNELS.gitBranches),
    createBranch: name => ipcRenderer.invoke(CHANNELS.gitCreateBranch, name),
    checkout: name => ipcRenderer.invoke(CHANNELS.gitCheckout, name),
    log: (limit, skip) => ipcRenderer.invoke(CHANNELS.gitLog, limit, skip),
    commitFiles: hash => ipcRenderer.invoke(CHANNELS.gitCommitFiles, hash),
    diff: (path, commit) => ipcRenderer.invoke(CHANNELS.gitDiff, path, commit),
    bytes: (path, ref) => ipcRenderer.invoke(CHANNELS.gitBytes, path, ref),
    remotes: () => ipcRenderer.invoke(CHANNELS.gitRemotes),
    addRemote: (name, url) => ipcRenderer.invoke(CHANNELS.gitAddRemote, name, url),
    fetch: () => ipcRenderer.invoke(CHANNELS.gitFetch),
    pull: () => ipcRenderer.invoke(CHANNELS.gitPull),
    push: setUpstream => ipcRenderer.invoke(CHANNELS.gitPush, setUpstream),
    resolve: (paths, side) => ipcRenderer.invoke(CHANNELS.gitResolve, paths, side),
    abortMerge: () => ipcRenderer.invoke(CHANNELS.gitAbortMerge),
    stash: message => ipcRenderer.invoke(CHANNELS.gitStash, message),
    stashes: () => ipcRenderer.invoke(CHANNELS.gitStashes),
    stashPop: index => ipcRenderer.invoke(CHANNELS.gitStashPop, index),
    stashDrop: index => ipcRenderer.invoke(CHANNELS.gitStashDrop, index),
    tag: (name, commit) => ipcRenderer.invoke(CHANNELS.gitTag, name, commit),
    hasCredentials: host => ipcRenderer.invoke(CHANNELS.gitHasCredentials, host),
    setCredentials: (host, user, token) =>
      ipcRenderer.invoke(CHANNELS.gitSetCredentials, host, user, token),
    clearCredentials: host => ipcRenderer.invoke(CHANNELS.gitClearCredentials, host),
  },
  dialog: {
    pickPath: (kind, startIn) => ipcRenderer.invoke(CHANNELS.dialogPickPath, kind, startIn),
    exportPicture: (name, image) => ipcRenderer.invoke(CHANNELS.dialogExportPicture, name, image),
  },
  documents: {
    list: () => ipcRenderer.invoke(CHANNELS.documentList),
    read: (id, kind) => ipcRenderer.invoke(CHANNELS.documentRead, id, kind),
    write: (id, kind, file, force, folder) =>
      ipcRenderer.invoke(CHANNELS.documentWrite, id, kind, file, force, folder),
    rename: (id, kind, title) => ipcRenderer.invoke(CHANNELS.documentRename, id, kind, title),
    remove: (id, kind) => ipcRenderer.invoke(CHANNELS.documentRemove, id, kind),
    confirmClose: title => ipcRenderer.invoke(CHANNELS.documentConfirmClose, title),
    confirmDelete: title => ipcRenderer.invoke(CHANNELS.documentConfirmDelete, title),
    confirmOverwrite: title => ipcRenderer.invoke(CHANNELS.documentConfirmOverwrite, title),
    confirmFlatten: (title, format, lost) =>
      ipcRenderer.invoke(CHANNELS.documentConfirmFlatten, title, format, lost),
  },
  assets: {
    search: query => ipcRenderer.invoke(CHANNELS.assetsSearch, query),
    onChanged: callback => subscribe<readonly Asset[]>(EVENTS.assetsChanged, callback),
    counts: () => ipcRenderer.invoke(CHANNELS.assetsCounts),
    peaks: assetId => ipcRenderer.invoke(CHANNELS.assetsPeaks, assetId),
    reveal: assetId => ipcRenderer.invoke(CHANNELS.assetsReveal, assetId),
    absent: assetIds => ipcRenderer.invoke(CHANNELS.assetsAbsent, assetIds),
    saveAudio: request => ipcRenderer.invoke(CHANNELS.assetsSaveAudio, request),
    savePicture: request => ipcRenderer.invoke(CHANNELS.assetsSavePicture, request),
    saveLayered: request => ipcRenderer.invoke(CHANNELS.assetsSaveLayered, request),
    readLayered: assetId => ipcRenderer.invoke(CHANNELS.assetsReadLayered, assetId),
    saveTexture: request => ipcRenderer.invoke(CHANNELS.assetsSaveTexture, request),
    installBundledTextures: () => ipcRenderer.invoke(CHANNELS.texturesInstallBundled),
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
  montage: {
    export: request => ipcRenderer.invoke(CHANNELS.montageExport, request),
    import: id => ipcRenderer.invoke(CHANNELS.montageImport, { id }),
    stems: request => ipcRenderer.invoke(CHANNELS.montageStems, request),
  },
  render: {
    start: request => ipcRenderer.invoke(CHANNELS.renderStart, request),
    frame: request => ipcRenderer.invoke(CHANNELS.renderFrame, request),
    finish: id => ipcRenderer.invoke(CHANNELS.renderFinish, id),
    cancel: id => ipcRenderer.invoke(CHANNELS.renderCancel, id),
  },
  material: {
    export: request => ipcRenderer.invoke(CHANNELS.materialExport, request),
  },
  skybox: {
    export: request => ipcRenderer.invoke(CHANNELS.skyboxExport, request),
  },
  tasks: {
    onProgress: callback => subscribe<TaskProgress>(EVENTS.taskProgress, callback),
    cancel: id => ipcRenderer.invoke(CHANNELS.taskCancel, id),
  },
  fonts: {
    list: () => ipcRenderer.invoke(CHANNELS.fontsList),
    read: family => ipcRenderer.invoke(CHANNELS.fontsRead, family),
  },
  animations: {
    list: () => ipcRenderer.invoke(CHANNELS.animationsList),
  },
  media: {
    adopt: relative => ipcRenderer.invoke(CHANNELS.mediaAdopt, relative),
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
  ai: {
    overview: () => ipcRenderer.invoke(CHANNELS.aiOverview),
    choose: (role, provider, scope) => ipcRenderer.invoke(CHANNELS.aiChoose, role, provider, scope),
    chooseMany: (writes, scope) => ipcRenderer.invoke(CHANNELS.aiChooseMany, writes, scope),
    install: modelId => ipcRenderer.invoke(CHANNELS.aiInstall, modelId),
    cancelInstall: () => ipcRenderer.invoke(CHANNELS.aiCancelInstall),
    installOllama: () => ipcRenderer.invoke(CHANNELS.aiInstallOllama),
    cancelInstallOllama: () => ipcRenderer.invoke(CHANNELS.aiCancelInstallOllama),
    readEngine: () => ipcRenderer.invoke(CHANNELS.aiReadEngine),
    installEngine: () => ipcRenderer.invoke(CHANNELS.aiInstallEngine),
    cancelInstallEngine: () => ipcRenderer.invoke(CHANNELS.aiCancelInstallEngine),
    remove: modelId => ipcRenderer.invoke(CHANNELS.aiRemove, modelId),
    load: modelId => ipcRenderer.invoke(CHANNELS.aiLoad, modelId),
    cancelLoad: () => ipcRenderer.invoke(CHANNELS.aiCancelLoad),
    unload: modelId => ipcRenderer.invoke(CHANNELS.aiUnload, modelId),
    addOwnModel: () => ipcRenderer.invoke(CHANNELS.aiAddOwnModel),
    onChanged: callback => subscribe<AiOverview>(EVENTS.ai, callback),
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
  help: {
    open: page => ipcRenderer.invoke(CHANNELS.helpOpen, page),
  },
  fileInfo: {
    open: relative => ipcRenderer.invoke(CHANNELS.fileInfoOpen, relative),
  },
  newDocument: {
    ask: request => ipcRenderer.invoke(CHANNELS.newDocumentAsk, request),
    request: () => ipcRenderer.invoke(CHANNELS.newDocumentRequest),
    answer: place => ipcRenderer.invoke(CHANNELS.newDocumentAnswer, place),
  },
  window: {
    toggleFullScreen: () => ipcRenderer.invoke(CHANNELS.windowToggleFullScreen),
    state: () => ipcRenderer.invoke(CHANNELS.windowState),
    onState: callback => subscribe<WindowState>(EVENTS.windowState, callback),
    language: () => ipcRenderer.invoke(CHANNELS.windowLanguage),
    onLanguage: callback => subscribe<Language>(EVENTS.windowLanguage, callback),
    setWorkspace: (workspace, tools, checked, abilities) =>
      ipcRenderer.invoke(CHANNELS.windowWorkspace, workspace, tools, checked, abilities),
  },
  menu: {
    popup: items => ipcRenderer.invoke(CHANNELS.menuPopup, items),
    onOpenTool: callback => subscribe<ToolRequest>(EVENTS.openTool, callback),
    onCommand: callback => subscribe<CommandId>(EVENTS.menuCommand, callback),
    onSceneAdd: callback => subscribe<SceneAddRequest>(EVENTS.sceneAdd, callback),
    onSceneView: callback => subscribe<SceneViewRequest>(EVENTS.sceneView, callback),
    onSceneDisplay: callback => subscribe<SceneDisplayRequest>(EVENTS.sceneDisplay, callback),
    onSceneExport: callback => subscribe<SceneExportCommand>(EVENTS.sceneExport, callback),
    onSceneCapture: callback => subscribe<SceneCaptureCommand>(EVENTS.sceneCapture, callback),
    onMaterialExport: callback => subscribe<TextureExportCommand>(EVENTS.materialExport, callback),
    onSkyboxExport: callback => subscribe<SkyboxExportCommand>(EVENTS.skyboxExport, callback),
  },
  diagnostics: {
    onLog: callback => subscribe<LogEntry>(EVENTS.log, callback),
    report: entry => ipcRenderer.invoke(CHANNELS.diagnosticsReport, entry),
    trace: entry => ipcRenderer.invoke(CHANNELS.diagnosticsTrace, entry),
  },
  news: {
    read: topic => ipcRenderer.invoke(CHANNELS.newsRead, topic),
  },
  updates: {
    state: () => ipcRenderer.invoke(CHANNELS.updateState),
    install: () => ipcRenderer.invoke(CHANNELS.updateInstall),
    onState: callback => subscribe<UpdateState>(EVENTS.updateState, callback),
  },
}

contextBridge.exposeInMainWorld('studio', bridge)

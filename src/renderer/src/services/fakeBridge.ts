import { vi } from 'vitest'
import type { CloseChoice, DocumentWrite } from '@shared/domain/document'
import { emptyAssetCounts } from '@shared/domain/asset'
import type { FileOutcome } from '@shared/domain/fileOp'
import { DEFAULT_ROLE_PATHS } from '@shared/domain/folderRole'
import { noGame } from '@shared/domain/game'
import { IDLE_RESCAN } from '@shared/domain/project'
import { noContext } from '@shared/domain/projectContext'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { DEFAULT_LANGUAGE } from '@shared/i18n/languages'
import type { AiOverview } from '@shared/domain/aiOverview'
import type { LogEntry, StudioBridge, TraceEntry } from '@shared/ipc'

/** A machine that answers nothing, which is what a test gets unless it says otherwise. */
const EMPTY_AI_OVERVIEW: AiOverview = {
  roles: [],
  machine: { physicalBytes: 0, availableBytes: 0, diskFreeBytes: null, gpu: null, vram: null },
  projectPath: null,
  installing: null,
  loading: null,
  loadFailure: null,
  installFailure: null,
  ollama: { ready: false, installed: false, names: [], progress: null, failed: false },
  engine: { known: false, missing: [], progress: null, failed: false },
}

const noSubscription = (): (() => void) => () => {}

/** An empty batch: nothing moved and nothing refused, which is what a stub owes a caller. */
const nothingMoved = (): Promise<FileOutcome> =>
  Promise.resolve({ done: [], refused: [], batch: 'batch-fake' })

/**
 * A complete `window.studio`, for renderer tests. Complete rather than partial on purpose:
 * a component that reaches for a channel the test forgot to stub must fail on what it
 * received, not on `undefined is not a function`.
 */
export type BridgeOverrides = { [K in keyof StudioBridge]?: Partial<StudioBridge[K]> }

export function installFakeBridge(overrides: BridgeOverrides = {}): StudioBridge {
  const bridge: StudioBridge = {
    settings: {
      read: () => Promise.resolve(DEFAULT_SETTINGS),
      write: () => Promise.resolve(DEFAULT_SETTINGS),
      authState: () => Promise.resolve({ authenticated: false, reason: 'missing' }),
      open: () => Promise.resolve(),
      runAction: () => Promise.resolve(),
      setPending: () => Promise.resolve(),
      onChange: noSubscription,
      onSection: noSubscription,
      ...overrides.settings,
    },
    // Nothing remembered unless a suite says otherwise: a fresh project is the ordinary one, and
    // a memory nobody stubbed must not have a window drawing rows nothing wrote.
    memory: {
      list: () => Promise.resolve([]),
      read: () => Promise.resolve(null),
      remember: () => Promise.resolve(null),
      amend: () => Promise.resolve(null),
      forget: () => Promise.resolve(false),
      rebuild: () => Promise.resolve(0),
      reset: () => Promise.resolve(),
      pending: () => Promise.resolve(0),
      index: () => Promise.resolve(),
      stopIndex: () => Promise.resolve(),
      compact: () => Promise.resolve(0),
      onChanged: noSubscription,
      onIndexed: noSubscription,
      ...overrides.memory,
    },
    mcp: {
      state: () => Promise.resolve({ port: null }),
      onState: noSubscription,
      ...overrides.mcp,
    },
    accounts: {
      list: () => Promise.resolve([]),
      add: () => Promise.resolve({ accounts: [] }),
      rename: () => Promise.resolve({ accounts: [] }),
      remove: () => Promise.resolve({ accounts: [] }),
      activate: () => Promise.resolve({ accounts: [] }),
      // Nothing known by default, which is the case every cloud but two is really in.
      credits: () => Promise.resolve({}),
      onChange: noSubscription,
      ...overrides.accounts,
    },
    provider: {
      searchModels: () => Promise.resolve({ items: [], cursor: null }),
      modelPreviews: () => Promise.resolve({}),
      describeModel: () => Promise.reject(new Error('no model')),
      // No plan by default, which is the "grey nothing out" case: a test that wants a row
      // refused says so itself, rather than every other test inheriting a restriction.
      plan: () => Promise.resolve(null),
      suggestPrompts: () => Promise.resolve([]),
      translatePrompt: draft => Promise.resolve({ text: draft, detectedLanguage: 'english' }),
      describeStyle: () => Promise.resolve({ description: '', synthesis: '' }),
      generate: () => Promise.reject(new Error('no generation')),
      estimateCost: () => Promise.resolve(null),
      uploadAsset: () => Promise.reject(new Error('no upload')),
      cancelJob: () => Promise.resolve(),
      listJobs: () => Promise.resolve([]),
      onProgress: noSubscription,
      onJobsChanged: noSubscription,
      usageReport: () => Promise.reject(new Error('no usage')),
      usageEvents: () => Promise.reject(new Error('no usage')),
      ...overrides.provider,
    },
    project: {
      create: () => Promise.reject(new Error('no project')),
      open: () => Promise.reject(new Error('no project')),
      current: () => Promise.resolve(null),
      close: () => Promise.resolve(),
      // No generation is running in a test unless it says so, and that is the answer with none.
      askLeave: () => Promise.resolve(true),
      onChange: noSubscription,
      listFolder: () => Promise.resolve([]),
      searchFolder: () => Promise.resolve([]),
      walkFolder: () => Promise.resolve([]),
      openFile: () => Promise.resolve(true),
      onFolderChanged: noSubscription,
      onRescan: noSubscription,
      rescanState: () => Promise.resolve(IDLE_RESCAN),
      stopRescan: () => Promise.resolve(),
      folderRoles: () => Promise.resolve({}),
      folderFor: role => Promise.resolve(DEFAULT_ROLE_PATHS[role]),
      onFolderRoles: noSubscription,
      // Nothing on disk unless a suite says otherwise, which is what the window under test then
      // reads as « this entry is no longer there » rather than as a blank pane.
      fileFacts: () => Promise.resolve(null),
      // No cards unless a suite says otherwise: a project with no context is the ordinary one.
      readContext: () => Promise.resolve(noContext()),
      writeContext: () => Promise.resolve(noContext()),
      onContextChanged: noSubscription,
      exportInto: () => Promise.resolve<string | null>(null),
      revealFile: () => Promise.resolve(),
      revealFolder: () => Promise.resolve(true),
      rename: () => Promise.reject(new Error('no project')),
      // Every file gesture answers "nothing happened, nothing refused" unless a test says
      // otherwise: an outcome nobody stubbed must not read as one that moved something, which
      // would have a suite believe the disk had agreed.
      renameFile: nothingMoved,
      moveFiles: nothingMoved,
      trashFiles: nothingMoved,
      newFolder: nothingMoved,
      duplicateFiles: nothingMoved,
      pasteFiles: nothingMoved,
      undoFile: nothingMoved,
      redoFile: nothingMoved,
      fileHistory: () => Promise.resolve({ undo: false, redo: false }),
      onFilesChanged: noSubscription,
      ...overrides.project,
    },
    git: {
      // No project by default, which is the state every screen has to survive — and the one a
      // test that never mentions version control should be looking at.
      read: () => Promise.resolve({ kind: 'no-project' }),
      init: () => Promise.resolve({ kind: 'no-project' }),
      stage: () => Promise.resolve({ kind: 'no-project' }),
      unstage: () => Promise.resolve({ kind: 'no-project' }),
      restore: () => Promise.resolve({ kind: 'no-project' }),
      commit: () => Promise.resolve({ kind: 'no-project' }),
      branches: () => Promise.resolve([]),
      createBranch: () => Promise.resolve({ kind: 'no-project' }),
      checkout: () => Promise.resolve({ kind: 'no-project' }),
      log: () => Promise.resolve([]),
      commitFiles: () => Promise.resolve([]),
      diff: () => Promise.resolve({ kind: 'empty' }),
      bytes: () => Promise.resolve(null),
      remotes: () => Promise.resolve([]),
      addRemote: () => Promise.resolve({ kind: 'no-project' }),
      fetch: () => Promise.resolve({ kind: 'no-project' }),
      pull: () => Promise.resolve({ kind: 'no-project' }),
      push: () => Promise.resolve({ kind: 'no-project' }),
      resolve: () => Promise.resolve({ kind: 'no-project' }),
      abortMerge: () => Promise.resolve({ kind: 'no-project' }),
      stash: () => Promise.resolve({ kind: 'no-project' }),
      stashes: () => Promise.resolve([]),
      stashPop: () => Promise.resolve({ kind: 'no-project' }),
      stashDrop: () => Promise.resolve({ kind: 'no-project' }),
      tag: () => Promise.resolve({ kind: 'no-project' }),
      hasCredentials: () => Promise.resolve(false),
      setCredentials: () => Promise.resolve(),
      clearCredentials: () => Promise.resolve(),
      ...overrides.git,
    },
    dialog: {
      exportPicture: () => Promise.resolve(null),
      pickPath: () => Promise.resolve(null),
      ...overrides.dialog,
    },
    game: {
      read: () => Promise.resolve(noGame()),
      // Refuses by default: a manifest nobody stubbed must not read as one that was written.
      write: () => Promise.reject(new Error('no game manifest stubbed')),
      scripts: () => Promise.resolve([]),
      writeScript: () => Promise.resolve(false),
      // `null` is « nobody picked a folder », which is what a suite that stubbed nothing means.
      export: () => Promise.resolve(null),
      ...overrides.game,
    },
    documents: {
      list: () => Promise.resolve([]),
      read: () => Promise.resolve(null),
      write: () => Promise.resolve<DocumentWrite>('written'),
      // Refuses by default, as the two dialogs below do: a rename nobody stubbed must not read
      // as one that worked, which would have a test believe the disk had agreed.
      rename: () => Promise.reject(new Error('no rename stubbed')),
      remove: () => Promise.resolve(),
      // Cancel and refuse: a test that does not stub these cannot lose a document by omission.
      confirmClose: () => Promise.resolve<CloseChoice>('cancel'),
      // Yes, where its neighbours answer no: this is the one dialogue whose default WRITES, and
      // a test that does not name it wants the save to go through.
      confirmFlatten: () => Promise.resolve(true),
      confirmDelete: () => Promise.resolve(false),
      confirmOverwrite: () => Promise.resolve(false),
      ...overrides.documents,
    },
    assets: {
      search: () => Promise.resolve([]),
      onChanged: noSubscription,
      counts: () => Promise.resolve(emptyAssetCounts()),
      peaks: () => Promise.resolve(null),
      reveal: () => Promise.resolve(false),
      // Nothing is absent by default: a suite that has said nothing about the disk is not one
      // where every file has gone, and answering otherwise would mark every fixture as lost.
      absent: () => Promise.resolve([]),
      saveAudio: () => Promise.reject(new Error('no project')),
      savePicture: () => Promise.reject(new Error('no project')),
      saveLayered: () => Promise.reject(new Error('no project')),
      // `null`, not a rejection: « this asset is not a container » is the ordinary answer, and
      // every caller of it falls back to opening a flat picture.
      readLayered: () => Promise.resolve(null),
      saveTexture: () => Promise.reject(new Error('no project')),
      installBundledTextures: () => Promise.resolve([]),
      extractTextures: () => Promise.reject(new Error('no project')),
      update: () => Promise.reject(new Error('no project')),
      remove: () => Promise.resolve(),
      describe: () => Promise.resolve(0),
      ...overrides.assets,
    },
    cloud: {
      browse: () => Promise.resolve({ assets: [], cursor: null }),
      explore: () => Promise.resolve({ assets: [], cursor: null }),
      similar: () => Promise.resolve([]),
      pull: () => Promise.resolve([]),
      push: () => Promise.resolve([]),
      plan: () =>
        Promise.resolve({ actions: [], summary: { push: 0, pull: 0, conflict: 0, skip: 0 } }),
      ...overrides.cloud,
    },
    favorites: {
      list: () => Promise.resolve([]),
      pin: () => Promise.resolve([]),
      unpin: () => Promise.resolve([]),
      ...overrides.favorites,
    },
    styles: {
      list: () => Promise.resolve([]),
      save: () => Promise.resolve([]),
      rename: () => Promise.resolve([]),
      remove: () => Promise.resolve([]),
      ...overrides.styles,
    },
    activity: {
      read: () => Promise.resolve([]),
      onEntries: () => () => {},
      ...overrides.activity,
    },
    post: {
      export: () => Promise.resolve(null),
      import: () => Promise.resolve(null),
      ...overrides.post,
    },
    scene: {
      export: () => Promise.resolve(null),
      ...overrides.scene,
    },
    montage: {
      export: () => Promise.resolve(null),
      import: () => Promise.resolve(null),
      stems: () => Promise.resolve(null),
      ...overrides.montage,
    },
    render: {
      start: () => Promise.resolve(null),
      frame: () => Promise.resolve(),
      finish: () => Promise.resolve(null),
      cancel: () => Promise.resolve(),
      ...overrides.render,
    },
    material: {
      export: () => Promise.resolve(null),
      ...overrides.material,
    },
    skybox: {
      export: () => Promise.resolve(null),
      ...overrides.skybox,
    },
    tasks: {
      onProgress: () => () => {},
      cancel: () => Promise.resolve(false),
      ...overrides.tasks,
    },
    // A test machine's installed faces are not the studio's business: the list is empty unless
    // a case says otherwise, so nothing under test depends on what happens to be on the disk.
    fonts: {
      list: () => Promise.resolve([]),
      read: () => Promise.resolve(null),
      ...overrides.fonts,
    },
    animations: {
      list: () => Promise.resolve([]),
      ...overrides.animations,
    },
    media: {
      ingest: () => Promise.resolve([]),
      adopt: () => Promise.resolve(null),
      cancel: () => Promise.resolve(),
      capabilities: () => Promise.resolve({ ffmpeg: true }),
      onProgress: noSubscription,
      ...overrides.media,
    },
    assistant: {
      think: () => Promise.resolve({ say: '', calls: [], cost: 0 }),
      onAction: noSubscription,
      actionResult: () => Promise.resolve(),
      ...overrides.assistant,
    },
    ai: {
      overview: () => Promise.resolve(EMPTY_AI_OVERVIEW),
      choose: () => Promise.resolve(EMPTY_AI_OVERVIEW),
      chooseMany: () => Promise.resolve(EMPTY_AI_OVERVIEW),
      install: () => Promise.resolve(EMPTY_AI_OVERVIEW),
      cancelInstall: () => Promise.resolve(EMPTY_AI_OVERVIEW),
      installOllama: () => Promise.resolve(EMPTY_AI_OVERVIEW),
      readEngine: () => Promise.resolve(EMPTY_AI_OVERVIEW),
      installEngine: () => Promise.resolve(EMPTY_AI_OVERVIEW),
      cancelInstallEngine: () => Promise.resolve(EMPTY_AI_OVERVIEW),
      cancelInstallOllama: () => Promise.resolve(EMPTY_AI_OVERVIEW),
      remove: () => Promise.resolve(EMPTY_AI_OVERVIEW),
      load: () => Promise.resolve(EMPTY_AI_OVERVIEW),
      cancelLoad: () => Promise.resolve(EMPTY_AI_OVERVIEW),
      unload: () => Promise.resolve(EMPTY_AI_OVERVIEW),
      addOwnModel: () => Promise.resolve(EMPTY_AI_OVERVIEW),
      onChanged: noSubscription,
      ...overrides.ai,
    },
    dictation: {
      state: () => Promise.resolve({ state: 'idle', download: null, failure: null }),
      start: () => Promise.resolve(),
      stop: () => Promise.resolve(),
      cancel: () => Promise.resolve(),
      push: () => Promise.resolve(),
      downloadModel: () => Promise.resolve(),
      cancelDownload: () => Promise.resolve(),
      openPrivacySettings: () => Promise.resolve(),
      onEvent: noSubscription,
      ...overrides.dictation,
    },
    mirror: {
      open: () => Promise.resolve(),
      ...overrides.mirror,
    },
    help: {
      open: () => Promise.resolve(),
      ...overrides.help,
    },
    fileInfo: {
      open: () => Promise.resolve(),
      ...overrides.fileInfo,
    },
    newDocument: {
      // Nobody to name it: the default answer is the one a window nobody opened gives.
      ask: () => Promise.resolve(null),
      request: () => Promise.resolve(null),
      answer: () => Promise.resolve(),
      ...overrides.newDocument,
    },
    window: {
      toggleFullScreen: () => Promise.resolve(),
      state: () => Promise.resolve({ active: true, fullScreen: false, maximized: false }),
      onState: noSubscription,
      language: () => Promise.resolve(DEFAULT_LANGUAGE),
      onLanguage: noSubscription,
      setWorkspace: () => Promise.resolve(),
      ...overrides.window,
    },
    diagnostics: {
      onLog: noSubscription,
      report: () => Promise.resolve(),
      trace: () => Promise.resolve(),
      ...overrides.diagnostics,
    },
    menu: {
      // Dismissed, which is what a test that never doubles this one wants: no row runs by
      // accident because a menu it did not think about was raised.
      popup: () => Promise.resolve(null),
      onOpenTool: noSubscription,
      onCommand: noSubscription,
      onSceneAdd: noSubscription,
      onSceneView: noSubscription,
      onSceneDisplay: noSubscription,
      onSceneExport: noSubscription,
      onSceneCapture: noSubscription,
      onMaterialExport: noSubscription,
      onSkyboxExport: noSubscription,
      ...overrides.menu,
    },
    news: {
      read: topic => Promise.resolve({ topic, items: [], readAt: '2026-08-24T00:00:00.000Z' }),
      ...overrides.news,
    },
    updates: {
      state: () => Promise.resolve({ phase: 'idle' }),
      install: () => Promise.resolve(),
      onState: noSubscription,
      ...overrides.updates,
    },
  }

  vi.stubGlobal('studio', bridge)
  return bridge
}

/**
 * A bridge whose log channel is watched. Four suites had grown their own copy of the same spy,
 * and the entries it collects are what `reportFailure` is asserted on.
 */
export function bridgeWatchingLogs(overrides: BridgeOverrides = {}) {
  const report = vi.fn((_entry: LogEntry) => Promise.resolve())
  const trace = vi.fn((_entry: TraceEntry) => Promise.resolve())
  installFakeBridge({ ...overrides, diagnostics: { report, trace, ...overrides.diagnostics } })

  return { report, trace, entries: () => report.mock.calls.map(([entry]) => entry) }
}

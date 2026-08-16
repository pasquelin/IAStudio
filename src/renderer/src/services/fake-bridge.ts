import { vi } from 'vitest'
import type { CloseChoice } from '@shared/domain/document'
import { emptyAssetCounts } from '@shared/domain/asset'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { DEFAULT_LANGUAGE } from '@shared/i18n/languages'
import type { LogEntry, StudioBridge } from '@shared/ipc'

const noSubscription = (): (() => void) => () => {}

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
    accounts: {
      list: () => Promise.resolve([]),
      add: () => Promise.resolve({ accounts: [] }),
      rename: () => Promise.resolve({ accounts: [] }),
      remove: () => Promise.resolve({ accounts: [] }),
      activate: () => Promise.resolve({ accounts: [] }),
      onChange: noSubscription,
      ...overrides.accounts,
    },
    scenario: {
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
      ...overrides.scenario,
    },
    project: {
      create: () => Promise.reject(new Error('no project')),
      open: () => Promise.reject(new Error('no project')),
      current: () => Promise.resolve(null),
      onChange: noSubscription,
      listFolder: () => Promise.resolve([]),
      openFile: () => Promise.resolve(true),
      onFolderChanged: noSubscription,
      revealFile: () => Promise.resolve(),
      revealFolder: () => Promise.resolve(true),
      rename: () => Promise.reject(new Error('no project')),
      renameFile: () => Promise.resolve(true),
      moveFile: () => Promise.resolve(true),
      trashFile: () => Promise.resolve(true),
      ...overrides.project,
    },
    dialog: {
      exportPicture: () => Promise.resolve(null),
      pickPath: () => Promise.resolve(null),
      ...overrides.dialog,
    },
    documents: {
      list: () => Promise.resolve([]),
      read: () => Promise.resolve(null),
      write: () => Promise.resolve(),
      // Refuses by default, as the two dialogs below do: a rename nobody stubbed must not read
      // as one that worked, which would have a test believe the disk had agreed.
      rename: () => Promise.reject(new Error('no rename stubbed')),
      remove: () => Promise.resolve(),
      // Cancel and refuse: a test that does not stub these cannot lose a document by omission.
      confirmClose: () => Promise.resolve<CloseChoice>('cancel'),
      confirmDelete: () => Promise.resolve(false),
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
      saveTexture: () => Promise.reject(new Error('no project')),
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
    scene: {
      export: () => Promise.resolve(null),
      ...overrides.scene,
    },
    render: {
      start: () => Promise.resolve(null),
      frame: () => Promise.resolve(),
      finish: () => Promise.resolve(null),
      cancel: () => Promise.resolve(),
      ...overrides.render,
    },
    texture: {
      export: () => Promise.resolve(null),
      ...overrides.texture,
    },
    skybox: {
      export: () => Promise.resolve(null),
      ...overrides.skybox,
    },
    // A test machine's installed faces are not the studio's business: the list is empty unless
    // a case says otherwise, so nothing under test depends on what happens to be on the disk.
    fonts: {
      list: () => Promise.resolve([]),
      read: () => Promise.resolve(null),
      ...overrides.fonts,
    },
    media: {
      ingest: () => Promise.resolve([]),
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
      onTextureExport: noSubscription,
      onSkyboxExport: noSubscription,
      ...overrides.menu,
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
  installFakeBridge({ ...overrides, diagnostics: { report, ...overrides.diagnostics } })

  return { report, entries: () => report.mock.calls.map(([entry]) => entry) }
}

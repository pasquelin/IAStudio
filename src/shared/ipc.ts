import type { AccountSummary, AccountsResult } from './domain/account'
import type { BundledAnimation } from './domain/animationLibrary'
import type { ActivityEntry, ActivityQuery } from './domain/activity'
import type { Asset, AssetChanges, AssetCounts, AssetQuery } from './domain/asset'
import type { FavoriteRecipe } from './domain/favorite'
import type { FileFacts } from './domain/fileInfo'
import type { FileHistory, FileOutcome } from './domain/fileOp'
import type { FolderEntry } from './domain/folder'
import type { OraDocument } from './domain/openRaster'
import type { MaterialStyle } from './domain/style'
import type { CloudAsset, CloudPage, CloudQuery, ExploreQuery } from './domain/cloudAsset'
import type { CommandId, MenuCheck } from './domain/command'
import type { ContextMenuItem } from './domain/contextMenu'
import type {
  ActionOutcome,
  AssistantAnswer,
  AssistantCall,
  AssistantThought,
} from './domain/assistant'
import type { SttEvent, SttSnapshot } from './domain/dictation'
import type {
  CloseChoice,
  DocumentDescriptor,
  DocumentDraft,
  DocumentFile,
  DocumentKind,
  DocumentWrite,
} from './domain/document'
import type {
  GitBranch,
  GitCommit,
  GitCommitFile,
  GitRemote,
  GitRepository,
  GitStashEntry,
} from './domain/git'
import type { GitDiff } from './domain/gitDiff'
import type { CostEstimate, Job, JobProgress, JobTarget } from './domain/job'
import type { IngestProgress, MediaCapabilities } from './domain/media'
import type { ModelDescriptor, ModelPage, ModelQuery } from './domain/model'
import type { PlanAccess } from './domain/plan'
import type { Project, RescanState } from './domain/project'
import type {
  PromptStyle,
  PromptSuggestion,
  PromptTranslation,
  SuggestPromptsRequest,
} from './domain/promptAssist'
import type {
  DisplayMode,
  ExportFormat,
  LightKind,
  MeshKind,
  ObjectKind,
  ViewDirection,
} from './domain/scene'
import type { ExportTargetId } from './domain/exportRegistry'
import type { TaskProgress } from './domain/taskProgress'
import type { TextureExportTarget } from './domain/textureExport'
import type { Language } from './i18n/languages'
import type { AuthState, PartialSettings, Settings, SettingsSectionId } from './domain/settings'
import type { PathKind, SettingActionId } from './domain/settingsRegistry'
import type { SyncOutcome, SyncPlan, SyncPolicy } from './domain/sync'
import type { PbrChannel } from './domain/texture'
import type { ToolId, ToolSurface, ToolZone } from './domain/tool'
import type { UpdateState } from './domain/update'
import type { UsageCursors, UsageEventPage, UsagePeriod, UsageReport } from './domain/usage'
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
  settingsAuthState: 'settings:auth-state'
  settingsOpen: 'settings:open'
  settingsRunAction: 'settings:run-action'
  settingsPending: 'settings:pending'

  accountsList: 'accounts:list'
  accountsAdd: 'accounts:add'
  accountsRename: 'accounts:rename'
  accountsRemove: 'accounts:remove'
  accountsActivate: 'accounts:activate'

  scenarioSearchModels: 'scenario:search-models'
  scenarioModelPreviews: 'scenario:model-previews'
  scenarioDescribeModel: 'scenario:describe-model'
  scenarioPlan: 'scenario:plan'
  scenarioSuggestPrompts: 'scenario:suggest-prompts'
  scenarioTranslatePrompt: 'scenario:translate-prompt'
  scenarioDescribeStyle: 'scenario:describe-style'
  scenarioGenerate: 'scenario:generate'
  scenarioEstimateCost: 'scenario:estimate-cost'
  scenarioUploadAsset: 'scenario:upload-asset'
  scenarioCancelJob: 'scenario:cancel-job'
  scenarioListJobs: 'scenario:list-jobs'
  scenarioUsageReport: 'scenario:usage-report'
  scenarioUsageEvents: 'scenario:usage-events'

  projectCreate: 'project:create'
  projectOpen: 'project:open'
  projectCurrent: 'project:current'
  projectListFolder: 'project:list-folder'
  projectSearchFolder: 'project:search-folder'
  projectWalkFolder: 'project:walk-folder'
  projectOpenFile: 'project:open-file'
  projectRevealFile: 'project:reveal-file'
  projectRevealFolder: 'project:reveal-folder'
  projectRename: 'project:rename'
  projectRenameFile: 'project:rename-file'
  projectMoveFiles: 'project:move-files'
  projectTrashFiles: 'project:trash-files'
  projectNewFolder: 'project:new-folder'
  projectDuplicateFiles: 'project:duplicate-files'
  projectPasteFiles: 'project:paste-files'
  projectUndoFile: 'project:undo-file'
  projectRedoFile: 'project:redo-file'
  projectFileHistory: 'project:file-history'
  projectStopRescan: 'project:stop-rescan'
  projectRescanState: 'project:rescan-state'
  projectFileFacts: 'project:file-facts'

  /**
   * Opens one file's information window, or reveals the one that path already has.
   *
   * Under `window:` because opening one is the whole of it — and because a channel's domain is
   * held to a single lowercase word (`ipc.test.ts`), which `file-info:` is not.
   */
  fileInfoOpen: 'window:file-info'

  gitRead: 'git:read'
  gitInit: 'git:init'
  gitStage: 'git:stage'
  gitUnstage: 'git:unstage'
  gitRestore: 'git:restore'
  gitCommit: 'git:commit'
  gitBranches: 'git:branches'
  gitCreateBranch: 'git:create-branch'
  gitCheckout: 'git:checkout'
  gitLog: 'git:log'
  gitCommitFiles: 'git:commit-files'
  gitDiff: 'git:diff'
  gitBytes: 'git:bytes'
  gitRemotes: 'git:remotes'
  gitAddRemote: 'git:add-remote'
  gitFetch: 'git:fetch'
  gitPull: 'git:pull'
  gitPush: 'git:push'
  gitResolve: 'git:resolve'
  gitAbortMerge: 'git:abort-merge'
  gitStash: 'git:stash'
  gitStashes: 'git:stashes'
  gitStashPop: 'git:stash-pop'
  gitStashDrop: 'git:stash-drop'
  gitTag: 'git:tag'
  gitHasCredentials: 'git:has-credentials'
  gitSetCredentials: 'git:set-credentials'
  gitClearCredentials: 'git:clear-credentials'

  dialogPickPath: 'dialog:pick-path'
  dialogExportPicture: 'dialog:export-picture'

  documentList: 'document:list'
  documentRead: 'document:read'
  documentWrite: 'document:write'
  documentRename: 'document:rename'
  documentRemove: 'document:remove'
  documentConfirmClose: 'document:confirm-close'
  documentConfirmDelete: 'document:confirm-delete'
  documentConfirmOverwrite: 'document:confirm-overwrite'

  assetsSearch: 'assets:search'
  assetsCounts: 'assets:counts'
  assetsPeaks: 'assets:peaks'
  assetsReveal: 'assets:reveal'
  assetsAbsent: 'assets:absent'
  assetsSaveAudio: 'assets:save-audio'
  assetsSavePicture: 'assets:save-picture'
  assetsSaveLayered: 'assets:save-layered'
  assetsReadLayered: 'assets:read-layered'
  assetsSaveTexture: 'assets:save-texture'
  assetsExtractTextures: 'assets:extract-textures'
  assetsUpdate: 'assets:update'
  assetsRemove: 'assets:remove'
  assetsDescribe: 'assets:describe'

  cloudBrowse: 'cloud:browse'
  cloudExplore: 'cloud:explore'
  cloudSimilar: 'cloud:similar'
  cloudPull: 'cloud:pull'
  cloudPush: 'cloud:push'
  cloudPlan: 'cloud:plan'

  favoritesList: 'favorites:list'
  favoritesPin: 'favorites:pin'
  favoritesUnpin: 'favorites:unpin'

  stylesList: 'styles:list'
  stylesSave: 'styles:save'
  stylesRename: 'styles:rename'
  stylesRemove: 'styles:remove'

  activityRead: 'activity:read'

  mediaAdopt: 'media:adopt'
  mediaIngest: 'media:ingest'
  mediaCancel: 'media:cancel'
  mediaAvailable: 'media:available'

  assistantThink: 'assistant:think'
  assistantActionResult: 'assistant:action-result'

  dictationState: 'dictation:state'
  dictationStart: 'dictation:start'
  dictationStop: 'dictation:stop'
  dictationCancel: 'dictation:cancel'
  dictationPush: 'dictation:push'
  dictationDownloadModel: 'dictation:download-model'
  dictationCancelDownload: 'dictation:cancel-download'
  dictationOpenPrivacy: 'dictation:open-privacy'

  sceneExport: 'scene:export'
  montageExport: 'montage:export'
  montageImport: 'montage:import'
  renderStart: 'render:start'
  renderFrame: 'render:frame'
  renderFinish: 'render:finish'
  renderCancel: 'render:cancel'

  textureExport: 'texture:export'
  skyboxExport: 'skybox:export'
  projectExport: 'project:export'
  taskCancel: 'task:cancel'

  fontsList: 'fonts:list'
  fontsRead: 'fonts:read'

  animationsList: 'animations:list'

  diagnosticsReport: 'diagnostics:report'
  diagnosticsTrace: 'diagnostics:trace'

  windowToggleFullScreen: 'window:toggle-full-screen'
  windowState: 'window:state'
  windowLanguage: 'window:language'
  windowWorkspace: 'window:workspace'
  /** Opens the video return, or reveals the one already open. See `MIRROR_ROUTE`. */
  mirrorOpen: 'mirror:open'

  menuPopup: 'menu:popup'

  updateState: 'update:state'
  updateInstall: 'update:install'
}

/**
 * Single source of channel names. Outside `shared/`, only `src/preload/` and `src/main/`
 * reference them; no component ever quotes a channel string — see spec § 4.
 */
export const CHANNELS: Channels = {
  settingsRead: 'settings:read',
  settingsWrite: 'settings:write',
  settingsAuthState: 'settings:auth-state',
  settingsOpen: 'settings:open',
  settingsRunAction: 'settings:run-action',
  settingsPending: 'settings:pending',

  accountsList: 'accounts:list',
  accountsAdd: 'accounts:add',
  accountsRename: 'accounts:rename',
  accountsRemove: 'accounts:remove',
  accountsActivate: 'accounts:activate',

  scenarioSearchModels: 'scenario:search-models',
  scenarioModelPreviews: 'scenario:model-previews',
  scenarioDescribeModel: 'scenario:describe-model',
  scenarioPlan: 'scenario:plan',
  scenarioSuggestPrompts: 'scenario:suggest-prompts',
  scenarioTranslatePrompt: 'scenario:translate-prompt',
  scenarioDescribeStyle: 'scenario:describe-style',
  scenarioGenerate: 'scenario:generate',
  scenarioEstimateCost: 'scenario:estimate-cost',
  scenarioUploadAsset: 'scenario:upload-asset',
  scenarioCancelJob: 'scenario:cancel-job',
  scenarioListJobs: 'scenario:list-jobs',
  scenarioUsageReport: 'scenario:usage-report',
  scenarioUsageEvents: 'scenario:usage-events',

  projectCreate: 'project:create',
  projectOpen: 'project:open',
  projectCurrent: 'project:current',
  projectListFolder: 'project:list-folder',
  projectSearchFolder: 'project:search-folder',
  projectWalkFolder: 'project:walk-folder',
  projectOpenFile: 'project:open-file',
  projectRevealFile: 'project:reveal-file',
  projectRevealFolder: 'project:reveal-folder',
  projectRename: 'project:rename',
  projectRenameFile: 'project:rename-file',
  projectMoveFiles: 'project:move-files',
  projectTrashFiles: 'project:trash-files',
  projectNewFolder: 'project:new-folder',
  projectDuplicateFiles: 'project:duplicate-files',
  projectPasteFiles: 'project:paste-files',
  projectUndoFile: 'project:undo-file',
  projectRedoFile: 'project:redo-file',
  projectFileHistory: 'project:file-history',
  projectStopRescan: 'project:stop-rescan',
  projectRescanState: 'project:rescan-state',
  projectFileFacts: 'project:file-facts',

  fileInfoOpen: 'window:file-info',

  gitRead: 'git:read',
  gitInit: 'git:init',
  gitStage: 'git:stage',
  gitUnstage: 'git:unstage',
  gitRestore: 'git:restore',
  gitCommit: 'git:commit',
  gitBranches: 'git:branches',
  gitCreateBranch: 'git:create-branch',
  gitCheckout: 'git:checkout',
  gitLog: 'git:log',
  gitCommitFiles: 'git:commit-files',
  gitDiff: 'git:diff',
  gitBytes: 'git:bytes',
  gitRemotes: 'git:remotes',
  gitAddRemote: 'git:add-remote',
  gitFetch: 'git:fetch',
  gitPull: 'git:pull',
  gitPush: 'git:push',
  gitResolve: 'git:resolve',
  gitAbortMerge: 'git:abort-merge',
  gitStash: 'git:stash',
  gitStashes: 'git:stashes',
  gitStashPop: 'git:stash-pop',
  gitStashDrop: 'git:stash-drop',
  gitTag: 'git:tag',
  gitHasCredentials: 'git:has-credentials',
  gitSetCredentials: 'git:set-credentials',
  gitClearCredentials: 'git:clear-credentials',

  dialogPickPath: 'dialog:pick-path',
  dialogExportPicture: 'dialog:export-picture',

  documentList: 'document:list',
  documentRead: 'document:read',
  documentWrite: 'document:write',
  documentRename: 'document:rename',
  documentRemove: 'document:remove',
  documentConfirmClose: 'document:confirm-close',
  documentConfirmDelete: 'document:confirm-delete',
  documentConfirmOverwrite: 'document:confirm-overwrite',

  assetsSearch: 'assets:search',
  assetsCounts: 'assets:counts',
  assetsPeaks: 'assets:peaks',
  assetsReveal: 'assets:reveal',
  assetsAbsent: 'assets:absent',
  assetsSaveAudio: 'assets:save-audio',
  assetsSavePicture: 'assets:save-picture',
  assetsSaveLayered: 'assets:save-layered',
  assetsReadLayered: 'assets:read-layered',
  assetsSaveTexture: 'assets:save-texture',
  assetsExtractTextures: 'assets:extract-textures',
  assetsUpdate: 'assets:update',
  assetsRemove: 'assets:remove',
  assetsDescribe: 'assets:describe',

  cloudBrowse: 'cloud:browse',
  cloudExplore: 'cloud:explore',
  cloudSimilar: 'cloud:similar',
  cloudPull: 'cloud:pull',
  cloudPush: 'cloud:push',
  cloudPlan: 'cloud:plan',

  favoritesList: 'favorites:list',
  favoritesPin: 'favorites:pin',
  favoritesUnpin: 'favorites:unpin',

  stylesList: 'styles:list',
  stylesSave: 'styles:save',
  stylesRename: 'styles:rename',
  stylesRemove: 'styles:remove',

  activityRead: 'activity:read',

  mediaAdopt: 'media:adopt',
  mediaIngest: 'media:ingest',
  mediaCancel: 'media:cancel',
  mediaAvailable: 'media:available',

  assistantThink: 'assistant:think',
  assistantActionResult: 'assistant:action-result',

  dictationState: 'dictation:state',
  dictationStart: 'dictation:start',
  dictationStop: 'dictation:stop',
  dictationCancel: 'dictation:cancel',
  dictationPush: 'dictation:push',
  dictationDownloadModel: 'dictation:download-model',
  dictationCancelDownload: 'dictation:cancel-download',
  dictationOpenPrivacy: 'dictation:open-privacy',

  sceneExport: 'scene:export',
  montageExport: 'montage:export',
  montageImport: 'montage:import',
  renderStart: 'render:start',
  renderFrame: 'render:frame',
  renderFinish: 'render:finish',
  renderCancel: 'render:cancel',

  textureExport: 'texture:export',
  skyboxExport: 'skybox:export',
  projectExport: 'project:export',
  taskCancel: 'task:cancel',

  fontsList: 'fonts:list',
  fontsRead: 'fonts:read',

  animationsList: 'animations:list',

  diagnosticsReport: 'diagnostics:report',
  diagnosticsTrace: 'diagnostics:trace',

  windowToggleFullScreen: 'window:toggle-full-screen',
  windowState: 'window:state',
  windowLanguage: 'window:language',
  windowWorkspace: 'window:workspace',
  mirrorOpen: 'mirror:open',

  menuPopup: 'menu:popup',

  updateState: 'update:state',
  updateInstall: 'update:install',
}

/**
 * What every "save an edit back into the project" channel carries, whatever the payload is.
 *
 * Written once because the three that extend it went from two to three in one batch, and the
 * per-field contract had already drifted: two spelled it out and the newcomer left it bare.
 */
export type SaveRequestBase = {
  /** The asset to overwrite, keeping its id and its place in the shelf. Absent creates one. */
  replaces?: string
  name: string
  /** The asset this one was edited from, so the two stay traceable to each other. */
  derivedFrom?: string
}

/** An edited take on its way back to disk — see `StudioBridge['assets']['saveAudio']`. */
export type SaveAudioRequest = SaveRequestBase & {
  /** 16-bit PCM WAV, encoded by the renderer that decoded it. */
  wav: Uint8Array
}

/**
 * An edited picture on its way back to disk — see `StudioBridge['assets']['savePicture']`.
 *
 * `png` is base64 where its two neighbours carry `Uint8Array`, and the reason is written where
 * the same pixels leave for an export: a `Buffer` does not cross the bridge, and base64 is what
 * the extraction already produced (`main/window/dialogs.ts`). `extract.base64` hands back a
 * string, `derive` hands back bytes; each sends what it holds rather than paying for a
 * conversion — which on a 4K picture is megabytes copied twice for nothing.
 */
export type SavePictureRequest = SaveRequestBase & {
  /** PNG payload, base64 and never a data URL — the prefix is part of the picture otherwise. */
  png: string
}

/**
 * A layered picture on its way to disk as OpenRaster — see `StudioBridge['assets']['saveLayered']`.
 *
 * Two channels rather than one taking either: what the main process does with them differs
 * entirely — one writes bytes it was handed, the other assembles a container.
 */
export type SaveLayeredRequest = SaveRequestBase & {
  document: OraDocument
}

/**
 * A channel the renderer computed, on its way into the project — see
 * `StudioBridge['assets']['saveTexture']`.
 *
 * `map` is required, and that is what keeps the channel honest: it says which of the eight
 * these pixels ARE, the shelf badges it, and the catalogue can then answer "which normal maps
 * does this project hold". Bytes with no channel are an ordinary picture and belong elsewhere.
 */
export type SaveTextureRequest = {
  name: string
  map: PbrChannel
  /** The channel asset they were computed from, so the two stay traceable to each other. */
  derivedFrom?: string
  /** PNG, encoded by the renderer that drew it. */
  png: Uint8Array
}

/** What a render is asked for, before a single frame is computed. */
export type RenderStartRequest = {
  /** Suggested file name, without its extension. */
  name: string
  /** Frames per second of the film, which is also the rate the stills are declared at. */
  fps: number
}

/** One computed frame, on its way to the staging folder. */
export type RenderFrameRequest = {
  /** The session it belongs to, as `render.start` answered it. */
  id: string
  /** Its place in the film. The order of the calls decides nothing. */
  index: number
  /** Already encoded by the renderer: the GPU lives where the scene does. */
  png: Uint8Array
}

/** A scene on its way to a file the studio will never look at again. */
export type SceneExportRequest = {
  /** Suggested file name, without its extension — the target decides that. */
  name: string
  format: ExportFormat
  /** Already encoded by the renderer: three.js's exporters run where the scene lives. */
  data: Uint8Array
}

/**
 * The montage itself, as an OpenTimelineIO file — the cut, not a film of it.
 *
 * Encoded by the renderer like a scene is, and for the same reason: only the window holds the
 * catalogue a clip's media is resolved against.
 */
export type MontageExportRequest = {
  /**
   * The row the window is already showing for this export, and the name `tasks.cancel` answers
   * to. Minted there rather than here: a bundle is gigabytes, and an id this side only handed
   * back at the END would leave the whole write unstoppable.
   */
  id: string
  /** Suggested file name, without its extension — the target decides that. */
  name: string
  /**
   * `montage.otio` for the cut alone, `montage.otioz` for the cut with its media inside.
   *
   * The two literals rather than `ExportTargetId`: this writer takes no other, and the wider type
   * let a caller pass `scene.glb` and compile, failing at runtime as an opaque parse error.
   */
  target: 'montage.otio' | 'montage.otioz'
  /** The serialized timeline. Text, never bytes: a bundle wraps it rather than writing it. */
  content: string
  /**
   * What the cut points at, for a bundle only. The PATHS never cross back: this side resolves
   * each url against the open project and reads it, so a montage cannot have a file outside the
   * project packed into something it then hands to somebody else.
   */
  media?: readonly { source: string; entry: string }[]
}

/**
 * What came out of a bundle the studio was asked to read.
 *
 * The cut travels as TEXT and the media as catalogue ids — never as bytes: the archive can be
 * gigabytes, and this side has already copied every medium into the project and given it a row.
 * The window relinks each clip by the entry its `target_url` names, and composes the document.
 */
export type MontageImportResult = {
  /** `content.otio`, verbatim. Parsed by the window, which is the side that reads a timeline. */
  content: string
  /** Each medium that landed, by the entry the cut names it under and the row it became. */
  media: readonly { entry: string; assetId: string }[]
  /** Where they landed, relative to the project — what the explorer will show them under. */
  folder: string
}

/** One file of an export, already encoded by the renderer that drew it. */
export type ExportedFile = {
  /** No separator and no extension: it is joined to a folder this process chose. */
  name: string
  /** Carried rather than derived: a target writes `.png`s, and one of them writes a `.glb`. */
  extension: string
  bytes: Uint8Array
}

/**
 * Several files on their way to a folder. Unlike a scene, this kind of export means nothing
 * file by file — a base colour without the ORM beside it is half a material, and five faces of
 * a sky are not a sky — so the dialog asks for a folder and they land in one named after them.
 *
 * Shared by the texture and the skybox rather than written twice: the two differ in what they
 * draw, never in what "write these together" means.
 */
export type FolderExportRequest = {
  /** The folder to create inside the chosen one, named after what is being exported. */
  folder: string
  files: readonly ExportedFile[]
  /**
   * Which entry of `exportRegistry` this is. The channels stay one per section — they are asked
   * from different places and refused for different reasons — but what they CARRY is one
   * vocabulary, so the writing side derives the extension it will accept instead of holding a
   * list that says nothing about which target went wrong.
   */
  target: ExportTargetId
}

export type LogLevel = 'info' | 'warn' | 'error'

export const LOG_LEVELS: readonly LogLevel[] = ['info', 'warn', 'error']

/**
 * Where in the renderer a failure was born. An inventory rather than free text: it is what a
 * reader greps for, and a typo in a string nobody reads back is a line that never surfaces.
 * The main process checks a report against this very list — see `registerDiagnosticsHandlers`.
 */
export type LogScope =
  | 'scene.model'
  | 'scene.bvh'
  | 'scene.texture'
  // Apart from `scene.model`, though both read a `.glb`: a scope says a subject once, so an
  // animation that will not load would otherwise silence what the MODEL had to say.
  | 'scene.animation'
  | 'scene.export'
  | 'scene.render'
  | 'sequence.export'
  /** Reading a montage back from a bundle another application wrote. */
  | 'sequence.import'
  /** An export asked for from outside, whichever space rendered it. */
  | 'document.export'
  | 'texture.map'
  | 'texture.channel'
  | 'texture.seam'
  | 'texture.shader'
  | 'texture.export'
  | 'skybox.source'
  | 'skybox.export'
  | 'canvas.layer'
  // Not `assets.open`, and the split is the point: the document DOES open here, and the code
  // carries on building it. What is reported is that it could not take the size of the picture
  // behind it — which matters because ⌘S writes the document's size back over that picture.
  // Said under `assets.open`, it read « this asset has nowhere to go » while the asset was
  // appearing on screen.
  | 'canvas.size'
  /** A save that refused to flatten a document over a source file whose format cannot hold it. */
  | 'canvas.flatten'
  // An edit sent to a model, whose picture the editor could not produce. Its own scope because
  // `canvas.flatten` already carries a sentence about a SAVE, and nothing was being saved here.
  | 'canvas.edit'
  | 'image.export'
  | 'document.load'
  | 'document.save'
  | 'document.close'
  | 'document.delete'
  // A name the folder refused. The field has closed by then — it commits on blur as much as on
  // Enter — so the journal is the only place left to say the name did not take.
  | 'document.rename'
  | 'assets.reveal'
  | 'assets.open'
  // ⌘S reaches the asset behind a document as well as the document itself, and the two halves
  // fail apart: the file can be written while the picture behind it is not.
  | 'assets.save'
  // ⇧⌘S makes a COPY and never rewrites anything, so its failures cannot be read as a save that
  // did not happen. One of them fires once the copy is already on disk — under `assets.save` the
  // journal denied a write that had just succeeded.
  | 'assets.copy'
  | 'assets.extract'
  // The catalogue refusing a new name. The field has closed by then — it commits on blur as much
  // as on Enter — so the journal is the only place left to say the name did not take.
  | 'assets.rename'
  // The catalogue refusing what a file IS. Corrected from a menu that closes on the pick, so
  // there is nothing left on screen for a refusal to appear in.
  | 'assets.retype'
  // The home's shelf: a folder moved since it was last opened is the ordinary case there, so
  // all three of its gestures need somewhere to say they did nothing.
  | 'project.reveal'
  | 'project.forget'
  | 'project.rename'
  | 'font.face'
  // Not a document's: a render that threw and a stored layout React refused belong to the shell
  // holding the documents, and both used to leave nothing behind in a packaged build.
  | 'shell.render'
  | 'shell.layout'
  // A menu the system refused to draw. It leaves nothing on screen to look at — no surface, no
  // half-open flyout — so a right-click that does nothing at all is the only symptom there is.
  | 'shell.menu'
  // The video return is a WINDOW, and a window the main process refuses to open leaves nothing
  // on screen to look at — the button simply appears not to work.
  | 'sequence.mirror'
  // Asking what a file IS can FAIL, and a failure is not the answer « the studio has no editor
  // for this ». Swallowed, it sent a file the studio opens to the system instead — measured on a
  // `.glb` double-clicked while a download held the catalogue.
  | 'explorer.open'

export const LOG_SCOPES: readonly LogScope[] = [
  'scene.model',
  'scene.bvh',
  'scene.texture',
  'scene.animation',
  'scene.export',
  'scene.render',
  'sequence.export',
  'sequence.import',
  'document.export',
  'texture.map',
  'texture.channel',
  'texture.seam',
  'texture.shader',
  'texture.export',
  'skybox.source',
  'skybox.export',
  'canvas.layer',
  'canvas.size',
  'canvas.flatten',
  'canvas.edit',
  'image.export',
  'document.load',
  'document.save',
  'document.close',
  'document.delete',
  'assets.reveal',
  'assets.open',
  'assets.save',
  'assets.copy',
  'assets.extract',
  'assets.rename',
  'assets.retype',
  'document.rename',
  'project.reveal',
  'project.forget',
  'project.rename',
  'font.face',
  'shell.render',
  'shell.layout',
  'shell.menu',
  'sequence.mirror',
  'explorer.open',
]

/**
 * Long enough for a stack trace, short enough that a renderer looping on a failure cannot fill
 * the terminal. Applied on both sides: by the sender so the boundary carries no more than it
 * has to, by the main process because the sandboxed side is trusted for nothing.
 */
export const MAX_LOG_MESSAGE = 4000

/**
 * A logged line, travelling either way.
 *
 * Towards the renderer, it is what the main process wants visible in devtools: the API calls
 * leave from the main process, so they never show up in the renderer's Network tab, and without
 * this mirror the terminal the app was launched from is the only place to watch them.
 *
 * Towards the main process, it is a failure the renderer has no other way to record — the log
 * belongs to the main process, and a `console.error` in a component would leave nothing behind
 * in a packaged build. The scope is prefixed on arrival, so a line always says which side it
 * came from.
 */
export type LogEntry = {
  level: LogLevel
  scope: string
  message: string
}

/**
 * What a trace is about — and the reason it is a union of its own rather than another `LogScope`.
 *
 * A scope names a failure the reader is meant to SEE: it lands in the project's journal, under a
 * translated sentence, and shows up as a toast on the way. A trace names one that only ever
 * reaches the log file the main process owns. Nothing about it is drawn.
 *
 * Merging the two lists would cost both sides: `TOPIC_OF_SCOPE` would have to answer "nowhere"
 * for some of its rows, and the bundle guard would ask for a sentence no surface displays.
 */
export type TraceScope =
  // A promise nobody awaited, rejected. This is the renderer's own silence: the calls that cross
  // to the main process throw their answer away, so a full disk on a rename reaches no `catch`.
  'shell.dropped'

/**
 * Disjoint from `LOG_SCOPES`, and the compiler is what holds that: while no name appears in both
 * unions, comparing one to the other does not typecheck. A name in both would reach the journal
 * through one channel and dodge it through the other.
 */
export const TRACE_SCOPES: readonly TraceScope[] = ['shell.dropped']

/** No level: a trace is always a failure, and a field with one legal value is a branch to test. */
export type TraceEntry = { scope: TraceScope; message: string }

/** Channels pushed from the main process to the renderer. */
export const EVENTS = {
  jobProgress: 'evt:job-progress',
  jobsChanged: 'evt:jobs-changed',
  mediaProgress: 'evt:media-progress',
  assistantAction: 'evt:assistant-action',
  dictation: 'evt:dictation',
  log: 'evt:log',
  projectChanged: 'evt:project-changed',
  projectFolderChanged: 'evt:project-folder-changed',
  filesChanged: 'evt:files-changed',
  projectRescan: 'evt:project-rescan',
  assetsChanged: 'evt:assets-changed',
  settingsChanged: 'evt:settings-changed',
  accountsChanged: 'evt:accounts-changed',
  openTool: 'evt:open-tool',
  menuCommand: 'evt:menu-command',
  windowState: 'evt:window-state',
  windowLanguage: 'evt:window-language',
  sceneAdd: 'evt:scene-add',
  sceneView: 'evt:scene-view',
  sceneDisplay: 'evt:scene-display',
  sceneExport: 'evt:scene-export',
  textureExport: 'evt:texture-export',
  skyboxExport: 'evt:skybox-export',
  taskProgress: 'evt:task-progress',
  settingsSection: 'evt:settings-section',
  updateState: 'evt:update-state',
  activity: 'evt:activity',
}

export type Unsubscribe = () => void

/** Request to open a tool, coming from the native menu. */
export type ToolRequest = {
  zone: ToolZone
  tool: ToolId
}

/** Request to drop a node in the active scene, coming from the native menu. */
export type SceneAddRequest = { kind: MeshKind | LightKind | ObjectKind }

/** Which of the six sides the menu asks the scene in front to look from. */
export type SceneViewRequest = { direction: ViewDirection }

/** Which of the seven ways of drawing the menu asks the scene in front to switch to. */
export type SceneDisplayRequest = { mode: DisplayMode }

/** What the native menu asks of the scene in front: a format, and how much of the scene. */
export type SceneExportCommand = { format: ExportFormat; scope: 'scene' | 'selection' }

/**
 * An action asked for from OUTSIDE the window — today, by an MCP client on the other side of
 * the machine.
 *
 * It travels as a PAIR, because the studio has no single round trip in that direction: `invoke`
 * goes renderer to main, `broadcast` goes back with no reply. So the main process sends this to
 * the window in front, and the window answers on `assistant:action-result` quoting the same
 * `callId`. A call nobody answers in time fails, and says which way it failed.
 */
export type AssistantActionRequest = { callId: string; call: AssistantCall }

export type AssistantActionResult = { callId: string; outcome: ActionOutcome }

/** What the native menu asks of the texture in front: which engine it is being handed to. */
export type TextureExportCommand = { target: TextureExportTarget }

/**
 * What the native menu asks of the sky in front: how large each of the six faces comes out.
 *
 * A size where a texture takes a target, because a sky has no per-engine recipe to choose from —
 * six PNGs named `_Rt`…`_Bk` is what all of them read. What differs is what the machine can
 * hold, and that is a number.
 */
export type SkyboxExportCommand = { size: number }

/**
 * What `window.studio` exposes. Every method that asks something maps to exactly one channel in
 * `CHANNELS`; every `on…` subscribes to exactly one entry of `EVENTS`.
 */
export type StudioBridge = {
  settings: {
    read: () => Promise<Settings>
    write: (partial: PartialSettings) => Promise<Settings>
    authState: () => Promise<AuthState>
    /** Opens the settings window on a section, or focuses it there if it is already up. */
    open: (section: SettingsSectionId) => Promise<void>
    /**
     * Runs one of the buttons of the settings window. A single channel rather than one per
     * action: they differ only by which id is named, and the main process is what decides
     * whether a given one is allowed to do anything.
     */
    runAction: (id: SettingActionId) => Promise<void>
    /**
     * Whether the settings window holds changes nobody has applied. Told to the main process
     * because closing a window is its decision, and it has no other way to know.
     */
    setPending: (pending: boolean) => Promise<void>
    /**
     * Settings are owned by the main process and replicated by every window. Without this, a
     * theme changed in the settings window would only reach the studio on the next launch.
     */
    onChange: (callback: (settings: Settings) => void) => Unsubscribe
    /** Section the settings window is asked to show while it is already open. */
    onSection: (callback: (section: SettingsSectionId) => void) => Unsubscribe
  }
  /**
   * The stored API keys. An API key carries its own project and team — the API lists neither —
   * so switching accounts is the only way to change which library the studio reads. The local
   * project is untouched by any of it: it is the user's disk.
   */
  accounts: {
    list: () => Promise<AccountSummary[]>
    /** Stores a key under a name. The name is required and must not already be taken. */
    add: (name: string, key: string, secret: string) => Promise<AccountsResult>
    rename: (id: string, name: string) => Promise<AccountsResult>
    remove: (id: string) => Promise<AccountsResult>
    activate: (id: string) => Promise<AccountsResult>
    /** Every window follows the switch: the account is owned by the main process. */
    onChange: (callback: (accounts: AccountSummary[]) => void) => Unsubscribe
  }
  scenario: {
    searchModels: (query?: ModelQuery) => Promise<ModelPage>
    /** Signed picture URL per asset id, absent for the ones the API has nothing for. */
    modelPreviews: (assetIds: readonly string[]) => Promise<Record<string, string>>
    describeModel: (modelId: string) => Promise<ModelDescriptor>
    /**
     * The account's plan, against which a model's `requiredPlanLevel` is read. `null` when it
     * cannot be read — the picker then offers everything, as it did before it asked.
     */
    plan: () => Promise<PlanAccess | null>
    /**
     * Rewrites a draft into on-model prompts, each with the settings the API proposes for it.
     * Free — measured at 0 creative units — and answered in one round trip: the endpoint hands
     * back a job, but its result is in the response, so nothing here is polled.
     */
    suggestPrompts: (request: SuggestPromptsRequest) => Promise<PromptSuggestion[]>
    /**
     * Carries a draft into the language the models are trained in, and says what it recognized
     * it as. Replaces the text rather than proposing beside it — nothing is invented here.
     */
    translatePrompt: (draft: string) => Promise<PromptTranslation>
    /** Reads the style of the reference pictures, so a prompt can be written from it. */
    describeStyle: (images: readonly string[]) => Promise<PromptStyle>
    generate: (modelId: string, body: Record<string, unknown>) => Promise<Job>
    /**
     * What running that exact form would cost, without running it. `null` when the API declines
     * to price it; a rejection when the call itself failed, which a caller may treat as no
     * figure.
     */
    estimateCost: (target: JobTarget, body: Record<string, unknown>) => Promise<CostEstimate>
    /** A picture, base64, up to 6 MB. Returns the id of the asset the API kept. */
    uploadAsset: (name: string, image: string) => Promise<string>
    cancelJob: (jobId: string) => Promise<void>
    listJobs: () => Promise<Job[]>
    onProgress: (callback: (progress: JobProgress) => void) => Unsubscribe
    /**
     * The whole list, sent when it gains or loses an entry rather than when one of them moves.
     *
     * A progress event names a job by id, so a replica can only merge it into one it already
     * holds: a job picked up from a previous session, and one that left the session because its
     * project is no longer open, are both invisible to `onProgress` by construction.
     */
    onJobsChanged: (callback: (jobs: Job[]) => void) => Unsubscribe
    /**
     * What every stored account spent over the period — consumption only, never a balance: the
     * API exposes no such thing. Accounts are queried together and a refused key is reported in
     * `silent` rather than failing the call, since a revoked key is the ordinary case.
     */
    usageReport: (period: UsagePeriod) => Promise<UsageReport>
    /**
     * The raw billable events, paged: the one section large enough to slow the window down.
     *
     * Cursors are opaque — hand back the ones the previous page returned, `{}` for the first.
     */
    usageEvents: (period: UsagePeriod, cursors: UsageCursors) => Promise<UsageEventPage>
  }
  project: {
    /**
     * Turns the CHOSEN folder into a project — it becomes the root, and the studio's folders are
     * laid inside it. No folder is made from a name: the one the user picked in the dialog is
     * the one they meant, and the project takes ITS name.
     *
     * Three answers rather than one, because a folder can already mean something. A folder that
     * is already a project is OPENED, never written over. One sitting inside another project is
     * refused. One holding files of its own asks the user first, and `null` is their "no" — a
     * cancelled gesture, not a failure, so nothing is journalled and nothing changes.
     */
    create: (path: string) => Promise<Project | null>
    open: (path: string) => Promise<Project>
    current: () => Promise<Project | null>
    onChange: (callback: (project: Project | null) => void) => Unsubscribe
    /**
     * One level of the project folder, `''` being the root. The explorer walks it a folder at a
     * time: `assets/img` holds thousands of files in an ordinary project, and a reader who never
     * opens it must not pay for them.
     *
     * `hidden` reveals what a leading dot hides — `.index/` and `.project.json`, the studio's own
     * bookkeeping. They are shown and stay READ-ONLY: every gesture over them is refused.
     */
    listFolder: (relative: string, hidden: boolean) => Promise<FolderEntry[]>
    /**
     * Every entry of the whole project folder whose name holds `term` — the explorer's second
     * source of nodes, and the only one that can answer for a folder nobody has unfolded.
     *
     * A flat list, in no order the reader should rely on: the tree rebuilds the ancestors of each
     * match and sorts what it draws. An empty term answers nothing rather than the whole folder.
     */
    searchFolder: (term: string, hidden: boolean) => Promise<FolderEntry[]>
    /**
     * Every FILE the project folder holds, at any depth — what the explorer reads to show the
     * project by what its files ARE rather than by where they sit.
     *
     * Folders do not come back: a folder is not a domain. A document written as a folder does,
     * as the item it is. The listing is flat and unordered; the panel groups and sorts it, and
     * asks the catalogue about the whole of it in one go (`AssetQuery.paths`).
     */
    walkFolder: (hidden: boolean) => Promise<FolderEntry[]>
    /**
     * Hands a file the studio cannot open to the system — a `.pdf` to its viewer. Answers
     * whether it was taken; a refusal is already in the journal, since a folder someone chose
     * is not a place to throw an exception from.
     */
    openFile: (relative: string) => Promise<boolean>
    /**
     * Something moved in the project folder. It does not say what: the panel re-reads the
     * folders it has open, which is cheaper than carrying a path through and never wrong.
     */
    onFolderChanged: (callback: () => void) => Unsubscribe
    /**
     * How far the pass reconciling the catalogue with the folder has got.
     *
     * A window is never the one who ASKS for a pass — opening a project and coming back to the
     * front are what do, and both are decided in the main process. What a window gets is the
     * right to see it happening and to call it off.
     */
    onRescan: (callback: (state: RescanState) => void) => Unsubscribe
    /** What a window opening mid-pass should be showing, since it missed the announcement. */
    rescanState: () => Promise<RescanState>
    /** Calls off the pass that is running. What it had already written stays written. */
    stopRescan: () => Promise<void>
    /**
     * What the disk says about one entry — size and stamps, for a folder as much as for a file.
     *
     * Asked path by path rather than folded into `listFolder`: a listing of four hundred rows
     * would pay four hundred `stat` calls for facts one window reads about one of them.
     *
     * `null` for a path that is no longer there, which is the ordinary case for a window left
     * open while the file it names was moved in the Finder.
     */
    fileFacts: (relative: string) => Promise<FileFacts | null>
    /**
     * Writes an export INSIDE the open project, in a folder of its own named by the caller.
     *
     * The other three export channels raise a native picker, which is why they exist as they do
     * and why no outside client can use them: nobody is there to fill it. This one takes the
     * destination instead, and pays for that by never letting it leave the project — `folder` is
     * one `pathSegment`, and the main process resolves both ends before it writes.
     *
     * Answers the folder name, never the path, exactly as its three neighbours do. `null` when
     * the destination resolved outside the project, which is the one refusal worth telling apart
     * from a failure.
     */
    exportInto: (request: FolderExportRequest) => Promise<string | null>
    /** Shows the file in the system's own file manager, so the path never leaves the process. */
    revealFile: (relative: string) => Promise<void>
    /**
     * Shows a project FOLDER, named by its own absolute path — the home's shelf points at
     * projects that are not open, and `revealFile` above can only name something inside the one
     * that is. The same path `open` already takes, and refused by the same parser.
     *
     * Answers whether the folder was there to show. `showItemInFolder` reports nothing and
     * no-ops on a path that has gone, and a folder moved since it was last opened is the
     * ordinary case for that shelf.
     */
    revealFolder: (path: string) => Promise<boolean>
    /**
     * Renames a PROJECT — the name in its manifest, never the folder on disk. Named by its own
     * absolute path, so the home's shelf can rename one it has not opened.
     *
     * The folder is deliberately left alone: `recentProjects`, `storage.lastProject` and every
     * absolute path the catalogue holds are keyed on it, and moving it would strand all three for
     * a display name. The manifest already allows the two to differ, which is exactly why
     * `RecentProject` stores the name instead of deriving it from the folder.
     *
     * Answers the project as it now reads. Throws when the folder will not open — a project
     * renamed out from under the studio is the same failure `open` reports.
     */
    rename: (path: string, name: string) => Promise<Project>
    /**
     * Renames in place — the name only, never the folder it sits in.
     *
     * The seven gestures below answer the same shape, and it is not a boolean: a batch is a
     * partial result by design, so what comes back is what MOVED and what was refused, with the
     * reason for each. A single rename simply has one member.
     */
    renameFile: (relative: string, name: string) => Promise<FileOutcome>
    /** Into another folder, keeping their names — the drag in the tree, and Couper puis Coller. */
    moveFiles: (paths: readonly string[], folder: string) => Promise<FileOutcome>
    /**
     * To the system's trash, never deleted. The studio does not erase anything in a folder that
     * belongs to someone else — and this is the one gesture `undoFile` cannot take back.
     */
    trashFiles: (paths: readonly string[]) => Promise<FileOutcome>
    /** One folder, inside `folder` — `''` for the project root itself. */
    newFolder: (folder: string, name: string) => Promise<FileOutcome>
    /** A copy of each beside itself, under the first free name — `Ruelle bleue 2.png`. */
    duplicateFiles: (paths: readonly string[]) => Promise<FileOutcome>
    /** What the clipboard holds, into `folder`: moved when it was cut, copied when it was not. */
    pasteFiles: (paths: readonly string[], folder: string, cut: boolean) => Promise<FileOutcome>
    /**
     * Takes the last batch back, and puts it back again. The stack lives in the main process,
     * per project: a file gesture belongs to no document, and two windows on one project would
     * otherwise keep two stacks that disagree.
     */
    undoFile: () => Promise<FileOutcome>
    redoFile: () => Promise<FileOutcome>
    /** Whether either gesture would do anything — what greys a menu row before it is clicked. */
    fileHistory: () => Promise<FileHistory>
    /**
     * A batch settled, in this window or another one. Carries what it did, so a tree can point
     * the selection at what has just appeared rather than guessing at it after a re-read.
     */
    onFilesChanged: (callback: (outcome: FileOutcome) => void) => Unsubscribe
  }
  /**
   * Version control over the PROJECT folder — the user's own files. Nothing here reaches the
   * repository the studio itself is built from.
   */
  git: {
    /**
     * Everything the panel draws, in one answer. A union rather than a status plus a handful of
     * booleans: no project, no git on this machine, and a folder never initialised each want
     * their own screen, and asking three channels would let two of them disagree.
     */
    read: () => Promise<GitRepository>
    /** `git init` on the open project, plus the ignore file, then the state it left. */
    init: () => Promise<GitRepository>
    /**
     * Every gesture answers with the state it LEFT rather than with nothing. One round trip
     * instead of two, and no window in which two panels could draw a folder already out of date.
     */
    stage: (paths: readonly string[]) => Promise<GitRepository>
    unstage: (paths: readonly string[]) => Promise<GitRepository>
    /** Puts files back the way the last recorded version has them — see `canRestore`. */
    restore: (paths: readonly string[]) => Promise<GitRepository>
    commit: (message: string, amend: boolean) => Promise<GitRepository>
    /** Read when the menu opens rather than with every status: it costs a command of its own. */
    branches: () => Promise<GitBranch[]>
    createBranch: (name: string) => Promise<GitRepository>
    checkout: (name: string) => Promise<GitRepository>
    /**
     * A page of the history, newest first, across every branch. Paged rather than read whole: a
     * project of two years is tens of thousands of commits, and the band shows twenty.
     */
    log: (limit: number, skip: number) => Promise<GitCommit[]>
    /** What one recorded version changed. Read when a row is picked, never with the page. */
    commitFiles: (hash: string) => Promise<GitCommitFile[]>
    /**
     * What changed inside one file — within `commit`, or against the last recorded version when
     * it is `null`. `binary` is the ordinary answer for most of a studio project, and what sends
     * the panel to `bytes` below.
     */
    diff: (path: string, commit: string | null) => Promise<GitDiff>
    /**
     * The bytes of a file at one version, or as it stands on disk when `ref` is `null` — which
     * is how two versions of a picture are put side by side.
     *
     * `null` for a path that version does not hold, and for anything past the ceiling the main
     * process keeps: these cross the boundary and are held in a window, and a project holds video.
     */
    bytes: (path: string, ref: string | null) => Promise<Uint8Array | null>
    remotes: () => Promise<GitRemote[]>
    addRemote: (name: string, url: string) => Promise<GitRepository>
    /** Takes what the server has without touching the working tree. */
    fetch: () => Promise<GitRepository>
    pull: () => Promise<GitRepository>
    /** `setUpstream` on the first push of a branch — the one that has nothing to track yet. */
    push: (setUpstream: boolean) => Promise<GitRepository>
    /**
     * Settles a conflict by keeping one whole side, and marks it settled in the same breath.
     *
     * During a MERGE, `ours` is the branch that is out and `theirs` is what is being brought in.
     * The two swap during a rebase — one reason the studio pulls with `--ff-only` and offers no
     * rebase: a gesture whose meaning depends on which operation is running is a gesture nobody
     * can be sure of.
     */
    resolve: (paths: readonly string[], side: 'ours' | 'theirs') => Promise<GitRepository>
    abortMerge: () => Promise<GitRepository>
    /** Sets the whole working tree aside, untracked files included, and comes back clean. */
    stash: (message: string) => Promise<GitRepository>
    stashes: () => Promise<GitStashEntry[]>
    stashPop: (index: number) => Promise<GitRepository>
    stashDrop: (index: number) => Promise<GitRepository>
    tag: (name: string, commit: string) => Promise<GitRepository>
    /**
     * Whether a token is held for a host — and NOTHING else about it.
     *
     * There is no channel that answers with a token, and that absence is the point: invariant 1
     * says the window asks whether it is authenticated, never what the credential is. The token
     * goes down to the main process once and only ever comes back out inside the environment of
     * a git command.
     */
    hasCredentials: (host: string) => Promise<boolean>
    setCredentials: (host: string, user: string, token: string) => Promise<void>
    clearCredentials: (host: string) => Promise<void>
  }
  dialog: {
    /**
     * A native picker, answering the chosen path or null when it was cancelled. One channel for
     * every path the interface asks for — where a project goes, where ffmpeg lives — because
     * they differ only by which picker opens.
     */
    pickPath: (kind: PathKind, startIn?: string) => Promise<string | null>
    /**
     * Asks where to put a picture and writes it there. Base64 in, path out — the renderer has
     * no filesystem, and the bytes are what it has.
     */
    exportPicture: (name: string, image: string) => Promise<string | null>
  }
  documents: {
    /** Every document the open project holds, read off its folder — the one source of truth. */
    list: () => Promise<DocumentDescriptor[]>
    /** `null` when nothing has been saved under that id yet. */
    read: (id: string, kind: DocumentKind) => Promise<DocumentFile | null>
    /**
     * The envelope — version, kind, timestamp — is stamped by the main process, not here.
     *
     * Answers `stale` and writes NOTHING when the file changed underneath — see `DocumentWrite`.
     * Ask with `confirmOverwrite`, then write again with `force`.
     *
     * `folder` is where a document written for the FIRST time lands — the folder its author
     * picked when they made it. It is read for a document with no file yet and ignored for one
     * that has: a save never moves what is already filed somewhere.
     */
    write: (
      id: string,
      kind: DocumentKind,
      draft: DocumentDraft,
      force?: boolean,
      folder?: string,
    ) => Promise<DocumentWrite>
    /**
     * Gives a document another name — which, the file being named after the document, moves it.
     *
     * The id does not change, and that is the point: the layout, the recent list and the open
     * tab all hold it, so a document may be renamed while it is open.
     *
     * Answers with the descriptor as it now stands, `path` included, so no window has to work
     * out where the document went — and it stays in the folder it was in, a rename being a name
     * and not a move. Rejects when THAT folder already holds the name —
     * `checkDocumentName` says the same thing before the gesture, this is what makes it true.
     */
    rename: (id: string, kind: DocumentKind, title: string) => Promise<DocumentDescriptor>
    remove: (id: string, kind: DocumentKind) => Promise<void>
    /**
     * What to do with a modified document being closed. Native rather than drawn in the window:
     * this is the OS convention every desktop application answers with, and the wording lives
     * beside the menu's — the renderer asks the question, it does not phrase it.
     */
    confirmClose: (title: string) => Promise<CloseChoice>
    /** Whether the document's file really goes. Destructive, so the safe answer is the default. */
    confirmDelete: (title: string) => Promise<boolean>
    /**
     * Whether to write over changes another application made. Asked only after `write` answered
     * `stale`, and answering no is what a dismissed dialog gives back.
     */
    confirmOverwrite: (title: string) => Promise<boolean>
  }
  assets: {
    search: (query: AssetQuery) => Promise<Asset[]>
    /**
     * Says the catalogue was written by the MAIN process, with no window having asked — the
     * pictures a model sheds on import are the case this exists for. Every other write is
     * answered where it was ordered, and the shelf invalidates itself there.
     *
     * No payload: what changed is a query away, and a window that was told « these six rows »
     * would still have to ask for the ones it is scoped to.
     */
    onChanged: (callback: () => void) => Unsubscribe
    /**
     * How many assets of each kind the project holds — counted in SQL, so the answer is six
     * numbers rather than the catalogue itself.
     */
    counts: () => Promise<AssetCounts>
    /**
     * The waveform computed at ingest, as min/max pairs at `PEAKS_PER_SECOND`. Null when the
     * asset carries no sound, or when ffmpeg was missing when it was brought in.
     */
    peaks: (assetId: string) => Promise<Float32Array | null>
    /**
     * Shows the asset's file in the OS file manager — the errand the path itself never crosses
     * this boundary for, see `withoutSourcePath`. False when there was no file to show.
     */
    reveal: (assetId: string) => Promise<boolean>
    /**
     * Which of these assets no longer have the file the catalogue records — the ids, never the
     * paths, which do not cross this boundary (see `withoutSourcePath`).
     *
     * Asked of a handful at a time rather than of the whole catalogue: a project holds hundreds
     * of rows and only the cells on screen need an answer, so the shelf asks for what it draws.
     * A row with no file to begin with — one that lives only in the library — is never absent:
     * nothing was expected of it.
     */
    absent: (assetIds: readonly string[]) => Promise<string[]>
    /** Writes an edited take back: over its source when `replaces` is set, beside it otherwise. */
    saveAudio: (request: SaveAudioRequest) => Promise<Asset>
    /**
     * Puts an edited picture into the project, as a NEW asset beside the one it came from.
     *
     * Always a new one, like `saveTexture` and for a related reason: a document's base layer is
     * sourced from the asset it was opened from, so overwriting that asset would feed the
     * flattened stack back into the layer it was flattened from.
     *
     * The kind and the channel are the source's own, read from the catalogue — a texture channel
     * edited as a picture stays a channel, which keeps it on the right shelf.
     */
    savePicture: (request: SavePictureRequest) => Promise<Asset>
    /**
     * Puts a LAYERED picture into the project, as an OpenRaster container.
     *
     * Unlike `savePicture` it may overwrite: the container holds the whole stack, so writing it
     * back over the file the document was opened from loses nothing — which is the difference an
     * open format buys, and the reason `formatCapability` exists to tell the two cases apart.
     */
    saveLayered: (request: SaveLayeredRequest) => Promise<Asset>
    /**
     * Reads a layered picture back, or `null` for an asset that is not one.
     *
     * `null` rather than a throw: opening a `.png` through this path is the ordinary case, not a
     * failure — the caller falls back to the one-layer document any flat picture opens as.
     */
    readLayered: (assetId: string) => Promise<OraDocument | null>
    /**
     * Puts a channel the renderer computed into the project.
     *
     * Always a new asset: a derivation is cheap to run again, and overwriting the file the
     * user pointed at would destroy pixels the studio did not author.
     */
    saveTexture: (request: SaveTextureRequest) => Promise<Asset>
    /**
     * Takes the pictures a `.glb` carries inside itself out into the project, one texture asset
     * each — which is what makes a downloaded model's own maps something the studio can open,
     * paint on, and hand back to a material.
     *
     * The bytes are copied, never decoded and re-encoded: what comes out is exactly what the
     * model was painted with. Each one is filed under the channel its glTF slot means, when the
     * slot means exactly one — `metallicRoughnessTexture` packs two and claims neither.
     *
     * Answers with what it created, newest last, and with an empty list for a model that carries
     * no picture at all. A picture already taken out is taken out again: the copy in the project
     * may have been painted since, and this is not the gesture that decides that.
     */
    extractTextures: (assetId: string) => Promise<Asset[]>
    /** Renames an asset or rewrites its tags. Whichever field is absent is left as it was. */
    update: (assetId: string, changes: AssetChanges) => Promise<Asset>
    /**
     * Drops assets from the project, and from the library too when asked.
     *
     * `alsoRemote` is not undone by anything: the API has no single-asset delete and no undo,
     * so the confirmation belongs to whoever calls this.
     */
    remove: (assetIds: readonly string[], alsoRemote: boolean) => Promise<void>
    /**
     * Names the chosen pictures from what the API sees in them, and answers how many it named.
     *
     * Only pictures the library already knows can be described — captioning takes an asset id —
     * so a selection of local-only files is answered with zero rather than an error.
     */
    describe: (assetIds: readonly string[]) => Promise<number>
  }
  /**
   * The account's library, which is not the project's catalogue.
   *
   * Kept apart on purpose: `catalog.db` belongs to a project, while the library belongs to the
   * key. Mirroring one into the other would copy the same library into every project and leave
   * as many stale copies to invalidate — so cloud assets are read through, and only become rows
   * once they are pulled.
   */
  cloud: {
    /** One page of the library. The cursor is opaque, and null once there is no more. */
    browse: (query: CloudQuery) => Promise<CloudPage>
    /**
     * One page of what everyone published, of a single kind and newest first — the home's
     * explore feed, and the one read here that returns assets this account does not own.
     *
     * Anything the API flagged is left out. Nothing is pulled by looking: a tile of the feed
     * belongs to somebody else until it is fetched like a library one.
     */
    explore: (query: ExploreQuery) => Promise<CloudPage>
    /**
     * Published assets that resemble the one named, that one taken out of its own results.
     *
     * The reference is the caller's to choose: the home measures against the library's most
     * recent asset, and a right-click elsewhere would name the asset under the pointer.
     */
    similar: (assetId: string) => Promise<CloudAsset[]>
    /**
     * Brings assets into the project, bytes and all. Answers what each one did — a download
     * that fails halfway has already written the ones before it, and a rejection would lose
     * that. The rows themselves arrive through the catalogue, which the store re-reads.
     */
    pull: (remoteAssetIds: readonly string[]) => Promise<SyncOutcome[]>
    /** Sends local assets up. Answers what each one did, successes and failures alike. */
    push: (assetIds: readonly string[]) => Promise<SyncOutcome[]>
    /** What a push or a pull would do, before it costs a single request. */
    plan: (assetIds: readonly string[], policy: SyncPolicy) => Promise<SyncPlan>
  }
  /** Recipes worth keeping, held outside every project — see `domain/favorite.ts`. */
  favorites: {
    list: () => Promise<FavoriteRecipe[]>
    /**
     * Pins what produced an asset of the open project. Answers the whole list, so a window never
     * has to guess where the new one landed. An asset nobody generated has no recipe to keep,
     * and the list comes back unchanged.
     */
    pin: (assetId: string) => Promise<FavoriteRecipe[]>
    unpin: (id: string) => Promise<FavoriteRecipe[]>
  }
  /** Saved ways of reading a material, held outside every project — see `domain/style.ts`. */
  styles: {
    list: () => Promise<MaterialStyle[]>
    /**
     * Keeps the values handed over. Each of the four answers the whole list, as the favourites
     * do: one write, one truth back, and a window that never has to guess where a row landed.
     */
    save: (style: MaterialStyle) => Promise<MaterialStyle[]>
    rename: (id: string, name: string) => Promise<MaterialStyle[]>
    remove: (id: string) => Promise<MaterialStyle[]>
  }
  /**
   * What the studio did, and what it failed to do — the surface it had none of.
   *
   * A line carries an i18n KEY and its parameters, never a sentence: the journal outlives the
   * language the interface was in when it was written. `detail` is `describeFailure` output and
   * nothing else, because an SDK message embeds the request, hence the API key.
   */
  activity: {
    read: (query: ActivityQuery) => Promise<ActivityEntry[]>
    /**
     * Lines as they are written, in batches. A push of two hundred assets is one message, not
     * two hundred — the same coalescing the ingest bar does with its progress.
     */
    onEntries: (callback: (entries: readonly ActivityEntry[]) => void) => Unsubscribe
  }
  scene: {
    /**
     * Writes an exported scene wherever the save dialog lands. Answers the file name it was
     * written under, or `null` when the dialog was dismissed — the name, never the path: where
     * a file sits is the main process's business, exactly as for an asset.
     */
    export: (request: SceneExportRequest) => Promise<string | null>
  }
  montage: {
    /**
     * Writes the cut as an OpenTimelineIO file wherever the save dialog lands — what `render`
     * below does for the picture, this does for the edit. Answers the file name, never the path.
     */
    export: (request: MontageExportRequest) => Promise<string | null>
    /**
     * Reads a bundle back: opens the picker, unpacks the media into the project and gives each a
     * catalogue row, then answers the cut and what it relinks to. `null` when the picker was
     * dismissed, no project is open, or the read was stopped.
     *
     * The id is minted by the window, as an export's is, and for the same reason: unpacking is
     * minutes of disk, and a name only handed back at the end would leave them unstoppable.
     */
    import: (id: string) => Promise<MontageImportResult | null>
  }
  /**
   * Rendering a scene to a film, in three steps: a session is opened once the save dialog has
   * answered, frames are staged one by one, and the encode happens at the end.
   *
   * Staged rather than piped, and asked for BEFORE anything is computed: a render is minutes of
   * work, and neither a broken pipe nor a dismissed dialog should throw all of it away.
   */
  render: {
    /** Answers the session id, or `null` when the save dialog was dismissed. */
    start: (request: RenderStartRequest) => Promise<string | null>
    frame: (request: RenderFrameRequest) => Promise<void>
    /** Encodes what was staged. Answers the file name, never the path. */
    finish: (id: string) => Promise<string | null>
    cancel: (id: string) => Promise<void>
  }
  texture: {
    /**
     * Writes an exported texture into a folder of its own, inside the one the dialog landed on.
     * Answers the folder's name, or `null` when the dialog was dismissed — the name, never the
     * path, exactly as a scene answers.
     */
    export: (request: FolderExportRequest) => Promise<string | null>
  }
  skybox: {
    /** The six faces of a sky, same bargain as a texture's folder — and the same writer. */
    export: (request: FolderExportRequest) => Promise<string | null>
  }
  /**
   * The two halves invariant 6 asks of a long task, for the ones this side RUNS — the bundle
   * being the one that matters, since it moves gigabytes with the window learning nothing. It
   * carries reading one back in as much as writing one out, which is why it is not named for the
   * export.
   *
   * What the window bakes itself — six faces of a sky, five channels of a material — is watched
   * and stopped where its loop lives and never comes through here.
   */
  tasks: {
    /** How far it has got. Silent for anything that finishes in one go. */
    onProgress: (callback: (progress: TaskProgress) => void) => Unsubscribe
    /**
     * Stops the task that was started under this id, half-written file and all. Answers whether
     * one was still running — an id that already finished is not a failure, it is a click that
     * arrived a moment late.
     */
    cancel: (id: string) => Promise<boolean>
  }
  /**
   * The typefaces the machine has installed. The studio's own three are not here: they ship
   * inside it, and `EMBEDDED_FONTS` names them without anyone having to ask.
   */
  fonts: {
    /** Every installed family, sorted, one cut each — see `systemFonts`. */
    list: () => Promise<string[]>
    /**
     * A face's outlines, as a font file the renderer can parse. `null` when the machine no
     * longer has that family, which is the missing-font hole a shared document opens.
     */
    read: (family: string) => Promise<Uint8Array | null>
  }
  /**
   * The animations shipped with the app — one folder per animation under `resources/animations`,
   * common to every project and read-only. Empty while none has been installed.
   */
  animations: {
    list: () => Promise<BundledAnimation[]>
  }
  media: {
    /**
     * Opens the native picker and links what was chosen — the file is never copied, so a
     * twenty-minute rush costs a catalogue row. Resolves once the assets exist, while their
     * ingest runs on and reports through `onProgress`.
     */
    ingest: () => Promise<Asset[]>
    /**
     * Gives a file the project ALREADY holds a row in the catalogue, so the studio can open it
     * instead of handing it to the system — the explorer's double-click on a `.jpg` somebody
     * copied in by hand. The bytes stay exactly where they are, as `ingest` leaves them.
     *
     * `null` when the studio has no editor for that file: the caller then opens it outside,
     * which is what a `.txt` and a `.pdf` are meant to do. The path is relative to the project,
     * and one that leaves it is refused.
     */
    adopt: (relative: string) => Promise<Asset | null>
    cancel: (assetId: string) => Promise<void>
    capabilities: () => Promise<MediaCapabilities>
    onProgress: (callback: (progress: IngestProgress) => void) => Unsubscribe
  }
  assistant: {
    /**
     * Works out what a sentence meant, and answers what to do about it.
     *
     * Thinking is the main process's business because the key, the rate limiter and the job loop
     * are there; deciding and acting is the window's, because that is where the actions are and
     * where the person is looking. So this asks a question and answers a plan — it never runs
     * anything itself.
     */
    think: (request: AssistantThought) => Promise<AssistantAnswer>
    /**
     * An action the main process is asking THIS window to run, because it came from outside it.
     * Sent to the window in front alone — running it in every window at once is the trap the
     * native menu already avoids.
     */
    onAction: (callback: (request: AssistantActionRequest) => void) => Unsubscribe
    /** What that window made of it, quoting the `callId` it was asked under. */
    actionResult: (result: AssistantActionResult) => Promise<void>
  }
  dictation: {
    /** The state as it stands, for a window that arrives after the events it missed. */
    state: () => Promise<SttSnapshot>
    /**
     * Opens a session: asks the operating system for the microphone, loads the engine if it is
     * not resident, and starts accepting audio. Resolves once the answer is known — which may
     * be `permissionRequired` or `modelMissing` rather than success.
     */
    start: () => Promise<void>
    /** Closes the segment in flight, so the last words are transcribed rather than dropped. */
    stop: () => Promise<void>
    /** Drops the segment in flight. What was said is not transcribed and not inserted. */
    cancel: () => Promise<void>
    /**
     * One chunk of 16-bit PCM at 16 kHz. Fire and forget, like `diagnostics.report`: nothing
     * decides on the answer, and awaiting one would put a round trip on every 100 ms of speech.
     */
    push: (chunk: ArrayBuffer) => Promise<void>
    downloadModel: () => Promise<void>
    cancelDownload: () => Promise<void>
    /**
     * Opens the operating system's microphone privacy screen. Takes no address: a renderer that
     * could name what gets opened would be a renderer that can open anything.
     */
    openPrivacySettings: () => Promise<void>
    onEvent: (callback: (event: SttEvent) => void) => Unsubscribe
  }
  window: {
    toggleFullScreen: () => Promise<void>
    state: () => Promise<WindowState>
    onState: (callback: (state: WindowState) => void) => Unsubscribe
    /**
     * The language this window draws in. Resolved by the main process and asked for rather than
     * worked out here, because the setting may say `'system'` and only that side sees what the
     * machine really prefers: the list this side can read starts with Chromium's UI locale,
     * which answers `en-US` for every system language Chromium ships no bundle for.
     *
     * The same value the native menu was built with, which is the point — an English menu above
     * a French window reads as a bug.
     */
    language: () => Promise<Language>
    onLanguage: (callback: (language: Language) => void) => Unsubscribe
    /**
     * Tells the main process which surface is up, which panels it can currently open, and
     * which menu rows are ticked, so the menu can follow all three. None of them can be worked
     * out on the other side: whether the generator exists depends on a model being chosen, and
     * whether a scene is drawn in wireframe is a fact of the document in front.
     *
     * The surface, not the workspace: the home covers the space behind it, and a menu built on
     * that space offered the image tools over a screen that edits no image.
     */
    setWorkspace: (
      surface: ToolSurface,
      tools: readonly ToolId[],
      checked: readonly MenuCheck[],
    ) => Promise<void>
  }
  /**
   * The video return — one window, revealed if it already exists.
   *
   * Nothing of the edit travels here: what the return SHOWS is published straight from one
   * renderer to the other, since every window of the studio runs the same bundle. This side only
   * owns what only the main process can do, which is to open a window.
   */
  mirror: {
    open: () => Promise<void>
  }
  /**
   * One file's information, as a window of its own — the studio's ⌘I.
   *
   * The only thing this side cannot do itself, exactly as `mirror` above: open a window. What
   * the window then SHOWS it reads for itself, through `project.fileFacts` and the catalogue.
   */
  fileInfo: {
    /** A path relative to the project folder — the spelling every panel names a file with. */
    open: (relative: string) => Promise<void>
  }
  menu: {
    /**
     * Draws these rows as a native context menu over the calling window, and answers the `id` of
     * the row that was chosen — `null` when the menu was dismissed.
     *
     * The window builds the rows because it is the only side that knows them: the labels come
     * from its own bundle, and `enabled` from state no other process replicates. What it does
     * NOT decide is where the menu appears — the system pops it at the pointer, which is the
     * whole reason for going through here rather than drawing a surface.
     */
    popup: (items: readonly ContextMenuItem[]) => Promise<string | null>
    onOpenTool: (callback: (request: ToolRequest) => void) => Unsubscribe
    onCommand: (callback: (command: CommandId) => void) => Unsubscribe
    onSceneAdd: (callback: (request: SceneAddRequest) => void) => Unsubscribe
    onSceneView: (callback: (request: SceneViewRequest) => void) => Unsubscribe
    onSceneDisplay: (callback: (request: SceneDisplayRequest) => void) => Unsubscribe
    onSceneExport: (callback: (command: SceneExportCommand) => void) => Unsubscribe
    onTextureExport: (callback: (command: TextureExportCommand) => void) => Unsubscribe
    onSkyboxExport: (callback: (command: SkyboxExportCommand) => void) => Unsubscribe
  }
  diagnostics: {
    onLog: (callback: (entry: LogEntry) => void) => Unsubscribe
    /**
     * The other direction: a failure born in the renderer, recorded by the process that owns the
     * log. Fire and forget — nothing decides anything on the answer, and a caller that awaited it
     * would make reporting a failure cost a round trip.
     */
    report: (entry: LogEntry) => Promise<void>
    /**
     * The same direction, for what nobody should be shown: this one stops at the log file. A
     * rejected promise is nothing the reader can act on — it names no gesture and no document —
     * so putting it in the journal would raise a toast about something already lost.
     *
     * Fire and forget, like `report`, and never deduplicated: a trace is read after the fact,
     * and how many times a thing happened is half of what it says.
     */
    trace: (entry: TraceEntry) => Promise<void>
  }
  updates: {
    /**
     * The state as it stands. A window opened after the download finished would otherwise show
     * nothing until the next event, and there is no next event once an update is ready.
     */
    state: () => Promise<UpdateState>
    /**
     * Quits and installs. Only does anything once the state is `ready`; the update is applied
     * on the next quit regardless, so this is the shortcut, never the only way.
     */
    install: () => Promise<void>
    onState: (callback: (state: UpdateState) => void) => Unsubscribe
  }
}

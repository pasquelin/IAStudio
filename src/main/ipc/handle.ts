import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import type { CHANNELS, StudioBridge } from '@shared/ipc'

/**
 * Pairs each channel with the bridge method it must implement. This table is what makes the
 * boundary typed on BOTH sides: without it, `CHANNELS` is a bag of strings and
 * `StudioBridge` a bag of functions, and a handler could answer `settings:read` with a
 * window state — failing only at runtime, inside a component.
 */
type ChannelMethod = {
  [CHANNELS.settingsRead]: StudioBridge['settings']['read']
  [CHANNELS.settingsWrite]: StudioBridge['settings']['write']
  [CHANNELS.settingsAuthState]: StudioBridge['settings']['authState']
  [CHANNELS.settingsOpen]: StudioBridge['settings']['open']
  [CHANNELS.settingsRunAction]: StudioBridge['settings']['runAction']
  [CHANNELS.settingsPending]: StudioBridge['settings']['setPending']

  [CHANNELS.accountsList]: StudioBridge['accounts']['list']
  [CHANNELS.accountsAdd]: StudioBridge['accounts']['add']
  [CHANNELS.accountsRename]: StudioBridge['accounts']['rename']
  [CHANNELS.accountsRemove]: StudioBridge['accounts']['remove']
  [CHANNELS.accountsActivate]: StudioBridge['accounts']['activate']

  [CHANNELS.scenarioSearchModels]: StudioBridge['scenario']['searchModels']
  [CHANNELS.scenarioModelPreviews]: StudioBridge['scenario']['modelPreviews']
  [CHANNELS.scenarioDescribeModel]: StudioBridge['scenario']['describeModel']
  [CHANNELS.scenarioPlan]: StudioBridge['scenario']['plan']
  [CHANNELS.scenarioSuggestPrompts]: StudioBridge['scenario']['suggestPrompts']
  [CHANNELS.scenarioTranslatePrompt]: StudioBridge['scenario']['translatePrompt']
  [CHANNELS.scenarioDescribeStyle]: StudioBridge['scenario']['describeStyle']
  [CHANNELS.scenarioGenerate]: StudioBridge['scenario']['generate']
  [CHANNELS.scenarioEstimateCost]: StudioBridge['scenario']['estimateCost']
  [CHANNELS.scenarioUploadAsset]: StudioBridge['scenario']['uploadAsset']
  [CHANNELS.scenarioCancelJob]: StudioBridge['scenario']['cancelJob']
  [CHANNELS.scenarioListJobs]: StudioBridge['scenario']['listJobs']
  [CHANNELS.scenarioUsageReport]: StudioBridge['scenario']['usageReport']
  [CHANNELS.scenarioUsageEvents]: StudioBridge['scenario']['usageEvents']

  [CHANNELS.projectCreate]: StudioBridge['project']['create']
  [CHANNELS.projectOpen]: StudioBridge['project']['open']
  [CHANNELS.projectCurrent]: StudioBridge['project']['current']
  [CHANNELS.projectListFolder]: StudioBridge['project']['listFolder']
  [CHANNELS.projectOpenFile]: StudioBridge['project']['openFile']
  [CHANNELS.projectRevealFile]: StudioBridge['project']['revealFile']
  [CHANNELS.projectRevealFolder]: StudioBridge['project']['revealFolder']
  [CHANNELS.projectRename]: StudioBridge['project']['rename']
  [CHANNELS.projectRenameFile]: StudioBridge['project']['renameFile']
  [CHANNELS.projectMoveFile]: StudioBridge['project']['moveFile']
  [CHANNELS.projectTrashFile]: StudioBridge['project']['trashFile']
  [CHANNELS.dialogPickPath]: StudioBridge['dialog']['pickPath']
  [CHANNELS.dialogExportPicture]: StudioBridge['dialog']['exportPicture']

  [CHANNELS.documentList]: StudioBridge['documents']['list']
  [CHANNELS.documentRead]: StudioBridge['documents']['read']
  [CHANNELS.documentWrite]: StudioBridge['documents']['write']
  [CHANNELS.documentRemove]: StudioBridge['documents']['remove']
  [CHANNELS.documentConfirmClose]: StudioBridge['documents']['confirmClose']
  [CHANNELS.documentConfirmDelete]: StudioBridge['documents']['confirmDelete']

  [CHANNELS.assetsSearch]: StudioBridge['assets']['search']
  [CHANNELS.assetsCounts]: StudioBridge['assets']['counts']
  [CHANNELS.assetsPeaks]: StudioBridge['assets']['peaks']
  [CHANNELS.assetsReveal]: StudioBridge['assets']['reveal']
  [CHANNELS.assetsAbsent]: StudioBridge['assets']['absent']
  [CHANNELS.assetsSaveAudio]: StudioBridge['assets']['saveAudio']
  [CHANNELS.assetsSavePicture]: StudioBridge['assets']['savePicture']
  [CHANNELS.assetsSaveTexture]: StudioBridge['assets']['saveTexture']
  [CHANNELS.assetsExtractTextures]: StudioBridge['assets']['extractTextures']
  [CHANNELS.assetsUpdate]: StudioBridge['assets']['update']
  [CHANNELS.assetsRemove]: StudioBridge['assets']['remove']
  [CHANNELS.assetsDescribe]: StudioBridge['assets']['describe']
  [CHANNELS.cloudBrowse]: StudioBridge['cloud']['browse']
  [CHANNELS.cloudExplore]: StudioBridge['cloud']['explore']
  [CHANNELS.cloudSimilar]: StudioBridge['cloud']['similar']
  [CHANNELS.cloudPull]: StudioBridge['cloud']['pull']
  [CHANNELS.cloudPush]: StudioBridge['cloud']['push']
  [CHANNELS.cloudPlan]: StudioBridge['cloud']['plan']

  [CHANNELS.favoritesList]: StudioBridge['favorites']['list']
  [CHANNELS.favoritesPin]: StudioBridge['favorites']['pin']
  [CHANNELS.favoritesUnpin]: StudioBridge['favorites']['unpin']

  [CHANNELS.stylesList]: StudioBridge['styles']['list']
  [CHANNELS.stylesSave]: StudioBridge['styles']['save']
  [CHANNELS.stylesRename]: StudioBridge['styles']['rename']
  [CHANNELS.stylesRemove]: StudioBridge['styles']['remove']

  [CHANNELS.activityRead]: StudioBridge['activity']['read']

  [CHANNELS.sceneExport]: StudioBridge['scene']['export']

  [CHANNELS.renderStart]: StudioBridge['render']['start']
  [CHANNELS.renderFrame]: StudioBridge['render']['frame']
  [CHANNELS.renderFinish]: StudioBridge['render']['finish']
  [CHANNELS.renderCancel]: StudioBridge['render']['cancel']

  [CHANNELS.textureExport]: StudioBridge['texture']['export']
  [CHANNELS.skyboxExport]: StudioBridge['skybox']['export']

  [CHANNELS.fontsList]: StudioBridge['fonts']['list']
  [CHANNELS.fontsRead]: StudioBridge['fonts']['read']

  [CHANNELS.diagnosticsReport]: StudioBridge['diagnostics']['report']

  [CHANNELS.mediaIngest]: StudioBridge['media']['ingest']
  [CHANNELS.mediaCancel]: StudioBridge['media']['cancel']
  [CHANNELS.mediaAvailable]: StudioBridge['media']['capabilities']

  [CHANNELS.assistantThink]: StudioBridge['assistant']['think']
  [CHANNELS.assistantActionResult]: StudioBridge['assistant']['actionResult']

  [CHANNELS.dictationState]: StudioBridge['dictation']['state']
  [CHANNELS.dictationStart]: StudioBridge['dictation']['start']
  [CHANNELS.dictationStop]: StudioBridge['dictation']['stop']
  [CHANNELS.dictationCancel]: StudioBridge['dictation']['cancel']
  [CHANNELS.dictationPush]: StudioBridge['dictation']['push']
  [CHANNELS.dictationDownloadModel]: StudioBridge['dictation']['downloadModel']
  [CHANNELS.dictationCancelDownload]: StudioBridge['dictation']['cancelDownload']
  [CHANNELS.dictationOpenPrivacy]: StudioBridge['dictation']['openPrivacySettings']

  [CHANNELS.windowToggleFullScreen]: StudioBridge['window']['toggleFullScreen']
  [CHANNELS.windowState]: StudioBridge['window']['state']
  [CHANNELS.windowLanguage]: StudioBridge['window']['language']
  [CHANNELS.windowWorkspace]: StudioBridge['window']['setWorkspace']

  [CHANNELS.mirrorOpen]: StudioBridge['mirror']['open']

  [CHANNELS.menuPopup]: StudioBridge['menu']['popup']

  [CHANNELS.updateState]: StudioBridge['updates']['state']
  [CHANNELS.updateInstall]: StudioBridge['updates']['install']
}

type Resolved<T> = T extends Promise<infer U> ? U : T

/**
 * Registers a handler whose arguments and return type are derived from the channel itself.
 * Answering with the wrong shape, or forgetting an argument, is a compile error.
 *
 * The handler may be synchronous or asynchronous: most channels reach the network or the
 * disk, and forcing a synchronous return would make the helper unusable for them.
 */
export function handle<C extends keyof ChannelMethod>(
  channel: C,
  handler: (
    event: IpcMainInvokeEvent,
    ...args: Parameters<ChannelMethod[C]>
  ) => Resolved<ReturnType<ChannelMethod[C]>> | Promise<Resolved<ReturnType<ChannelMethod[C]>>>,
): void {
  ipcMain.handle(channel, (event, ...args) =>
    handler(event, ...(args as Parameters<ChannelMethod[C]>)),
  )
}

import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { app } from 'electron'
import { registerAssetHandlers } from '@main/assets/handlers'
import { registerBundledTextureHandlers } from '@main/assets/bundledTextures'
import { bundledTextures, resourcesRoot } from '@main/resources'
import { registerDiagnosticsHandlers } from '@main/diagnostics/handlers'
import { createInstalledFonts } from '@main/fonts/disk'
import { registerAnimationHandlers } from '@main/animations'
import { registerFontHandlers } from '@main/fonts/handlers'
import { registerFavoriteHandlers } from '@main/favorites/handlers'
import { registerStyleHandlers } from '@main/styles/handlers'
import { readFavoriteThumbnail } from '@main/favorites/thumbnail'
import { registerAssistantHandlers } from '@main/assistant/handlers'
import { registerDictationHandlers } from '@main/dictation/handlers'
import { registerMediaHandlers } from '@main/media/handlers'
import { registerMenuHandlers } from '@main/menu'
import { createCredentialVault } from '@main/git/credentials'
import { registerGitHandlers } from '@main/git/handlers'
import { createElectronAdapter } from '@main/settings/adapter'
import { registerProjectHandlers } from '@main/project/handlers'
import { registerScenarioHandlers } from '@main/scenario/handlers'
import { TRANSLATIONS } from '@shared/i18n'
import { CURRENT } from '@main/logFile'
import { runSettingAction } from '@main/settings/actions'
import { registerSettingsHandlers } from '@main/settings/handlers'
import { registerWindowControls } from '@main/window/controls'
import { registerContextMenu } from '@main/window/contextMenu'
import { registerDialogHandlers } from '@main/window/dialogs'
import { registerSceneHandlers } from '@main/scene/export'
import { registerExportHandlers } from '@main/export/folder'
import { registerMontageHandlers } from '@main/export/montage'
import { createRunningTasks, registerTaskCancelHandler } from '@main/task/runningTasks'
import { registerMontageImportHandlers } from '@main/import/montageImport'
import { registerRenderHandlers } from '@main/render/handlers'
import { registerUpdateHandlers } from '@main/update/handlers'
import { registerFileInfoWindow } from '@main/window/fileInfo'
import { registerMirrorWindow } from '@main/window/mirror'
import { registerNewDocumentWindow } from '@main/window/newDocument'
import { markSettingsPending, openSettingsWindow } from '@main/window/windows'
import type { Services } from '@main/services'

/** Single place where the IPC surface is wired. Registered once, before any window loads. */
export function registerIpc(services: Services): void {
  registerWindowControls()
  registerMirrorWindow()
  registerFileInfoWindow()
  registerNewDocumentWindow()
  registerContextMenu()
  registerMenuHandlers()
  registerDiagnosticsHandlers(() => services.journal)
  // Wired here rather than held by `Services`: opening a window is not a service, and this is
  // where the two sides of the boundary are already being joined.
  registerSettingsHandlers({
    ...services,
    openSettings: openSettingsWindow,
    setPending: markSettingsPending,
    runAction: runSettingAction({
      settings: services.settings,
      settingsPath: services.settings.path,
      logFile: () => join(app.getPath('logs'), CURRENT),
      mcpEndpoint: services.mcp.endpoint,
      onResolveMissing: () => {
        const t = TRANSLATIONS[services.language()].settings.installResolveBridge
        void services.askUser({
          message: t.missing,
          detail: t.missingDetail,
          buttons: [t.missingOk],
          defaultId: 0,
          cancelId: 0,
        })
      },
    }),
  })
  registerScenarioHandlers(services)
  registerProjectHandlers({ ...services, record: entry => services.journal.record(entry) })
  registerBundledTextureHandlers({
    catalog: () => services.project.catalog(),
    assets: services.assets,
    newAssetId: services.newAssetId,
    folder: () => bundledTextures(resourcesRoot()),
    projectPath: () => services.project.path(),
    exists: services.exists,
  })
  const git = registerGitHandlers({
    // The same file and the same keychain the API key already uses. A second store would be a
    // second place a secret can be left behind on a machine somebody stops trusting.
    vault: createCredentialVault(createElectronAdapter()),
    project: services.project,
    binaryPath: () => services.settings.read().git.binary || undefined,
    // Both halves or neither: git wants a name AND an address, and handing it one would make
    // every commit fail on the other. Left out, git reads the machine's own configuration.
    identity: () => {
      const { userName, userEmail } = services.settings.read().git
      return userName && userEmail ? { name: userName, email: userEmail } : undefined
    },
  })

  /**
   * A changed binary has to reach the service, which holds both the detection and the port bound
   * to it. Without this the preference could be edited and nothing would read it until the next
   * launch — the service would go on saying git is missing on a machine that has just been told
   * where it is.
   */
  services.settings.subscribe(() => git.forget())
  registerAssetHandlers({
    catalog: () => services.project.catalog(),
    remote: services.remote,
    cloud: services.cloud,
    removeFile: services.removeAssetFile,
    renameFile: services.files.renameAsset,
    activeOwnerId: services.ownerScope.current,
    journal: () => services.journal,
    captionArrivals: services.captionArrivals,
    describeAssets: services.describeAssets,
  })
  registerFavoriteHandlers({
    favorites: services.favorites,
    project: services.project,
    readThumbnail: readFavoriteThumbnail,
    newFavoriteId: () => `favorite_${randomUUID()}`,
    now: () => new Date().toISOString(),
  })
  registerStyleHandlers(services.styles)
  registerMediaHandlers(services)
  registerAssistantHandlers({
    brain: services.assistant,
    settleAction: services.remoteActions.settle,
  })
  registerDictationHandlers({
    session: services.dictation,
    openPrivacySettings: services.openMicrophoneSettings,
  })
  registerDialogHandlers(services)
  registerSceneHandlers(services)
  registerExportHandlers(services)
  // One table for both: the window names a task, this side runs it under that name, and the stop
  // button reaches it by the same name. Built here so neither handler owns the other's door.
  const running = createRunningTasks()
  registerMontageHandlers({ ...services, running })
  // The same table both ways: an unpack is as long as a pack, and the stop button is one button.
  registerMontageImportHandlers({ ...services, running })
  registerTaskCancelHandler(running)
  registerRenderHandlers({
    ...services,
    newId: () => `render_${randomUUID()}`,
    encode: services.encodeVideo,
  })
  registerUpdateHandlers(services)
  // Built here rather than held by `Services`: the index reads nothing until a picker asks, so
  // it costs a closure at startup and a folder walk the first time someone opens the list.
  registerFontHandlers(createInstalledFonts())
  registerAnimationHandlers()
}

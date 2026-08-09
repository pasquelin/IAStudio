import { randomUUID } from 'node:crypto'
import { registerAssetHandlers } from '@main/assets/handlers'
import { registerDiagnosticsHandlers } from '@main/diagnostics/handlers'
import { createInstalledFonts } from '@main/fonts/disk'
import { registerFontHandlers } from '@main/fonts/handlers'
import { registerFavoriteHandlers } from '@main/favorites/handlers'
import { registerStyleHandlers } from '@main/styles/handlers'
import { readFavoriteThumbnail } from '@main/favorites/thumbnail'
import { registerMediaHandlers } from '@main/media/handlers'
import { registerMenuHandlers } from '@main/menu'
import { registerProjectHandlers } from '@main/project/handlers'
import { registerScenarioHandlers } from '@main/scenario/handlers'
import { runSettingAction } from '@main/settings/actions'
import { registerSettingsHandlers } from '@main/settings/handlers'
import { registerWindowControls } from '@main/window/controls'
import { registerDialogHandlers } from '@main/window/dialogs'
import { registerSceneHandlers } from '@main/scene/export'
import { registerUpdateHandlers } from '@main/update/handlers'
import { markSettingsPending, openSettingsWindow } from '@main/window/windows'
import type { Services } from '@main/services'

/** Single place where the IPC surface is wired. Registered once, before any window loads. */
export function registerIpc(services: Services): void {
  registerWindowControls()
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
    }),
  })
  registerScenarioHandlers(services)
  registerProjectHandlers(services)
  registerAssetHandlers({
    catalog: () => services.project.catalog(),
    remote: services.remote,
    cloud: services.cloud,
    removeFile: services.removeAssetFile,
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
  registerDialogHandlers(services)
  registerSceneHandlers(services)
  registerUpdateHandlers(services)
  // Built here rather than held by `Services`: the index reads nothing until a picker asks, so
  // it costs a closure at startup and a folder walk the first time someone opens the list.
  registerFontHandlers(createInstalledFonts())
}

import { registerMediaHandlers } from '@main/media/handlers'
import { registerMenuHandlers } from '@main/menu'
import { registerProjectHandlers } from '@main/project/handlers'
import { registerScenarioHandlers } from '@main/scenario/handlers'
import { runSettingAction } from '@main/settings/actions'
import { registerSettingsHandlers } from '@main/settings/handlers'
import { registerWindowControls } from '@main/window/controls'
import { registerDialogHandlers } from '@main/window/dialogs'
import { markSettingsPending, openSettingsWindow } from '@main/window/windows'
import type { Services } from '@main/services'

/** Single place where the IPC surface is wired. Registered once, before any window loads. */
export function registerIpc(services: Services): void {
  registerWindowControls()
  registerMenuHandlers()
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
  registerMediaHandlers(services)
  registerDialogHandlers(services)
}

import { registerMenuHandlers } from '@main/menu'
import { registerProjectHandlers } from '@main/project/handlers'
import { registerScenarioHandlers } from '@main/scenario/handlers'
import { registerSettingsHandlers } from '@main/settings/handlers'
import { registerWindowControls } from '@main/window/controls'
import type { Services } from '@main/services'

/** Single place where the IPC surface is wired. Registered once, before any window loads. */
export function registerIpc(services: Services): void {
  registerWindowControls()
  registerMenuHandlers()
  registerSettingsHandlers(services)
  registerScenarioHandlers(services)
  registerProjectHandlers(services)
}

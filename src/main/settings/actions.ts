import { BrowserWindow, shell } from 'electron'
import type { SettingActionId } from '@shared/domain/settings-registry'
import type { SettingsStore } from './store'

export type ActionDeps = {
  settings: SettingsStore
  /** Where the settings file lives, so it can be revealed without guessing the path. */
  settingsPath: () => string
}

/**
 * What the buttons of the settings window do. Kept apart from the handlers: each one reaches
 * straight into Electron, and the handler that routes them stays testable without it.
 */
export function runSettingAction({ settings, settingsPath }: ActionDeps) {
  return (id: SettingActionId): void => {
    switch (id) {
      case 'advanced.openSettingsFile':
        // Revealed rather than opened: the file is JSON, and whatever the OS opens it with is
        // less useful than seeing where it sits — next to the rest of the profile.
        shell.showItemInFolder(settingsPath())
        return

      case 'advanced.openDevtools':
        BrowserWindow.getFocusedWindow()?.webContents.openDevTools({ mode: 'detach' })
        return

      case 'advanced.reset':
        // `reset`, not `write(DEFAULT_SETTINGS)`: a write merges, and the settings with no
        // default would have survived the reset. Broadcast like any other change, so every
        // window follows without being told.
        settings.reset()
        return
    }
  }
}

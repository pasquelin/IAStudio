import { homedir } from 'node:os'
import { BrowserWindow, clipboard, shell } from 'electron'
import { APP_NAME } from '@shared/constants'
import type { SettingActionId } from '@shared/domain/settingsRegistry'
import { installResolveScript } from '@main/bridge/resolveBridge'
import { log } from '@main/log'
import { clientName, mcpAddCommand, mcpConfigJson, type McpLaunch } from '@main/mcp/endpoint'
import type { SettingsStore } from './store'

export type ActionDeps = {
  settings: SettingsStore
  /** Where the settings file lives, so it can be revealed without guessing the path. */
  settingsPath: () => string
  /** Where `main.log` lives — the folder Electron hands out, not one this side works out. */
  logFile: () => string
  /** Holding no port and no token, it is as true with the way in shut — hence both buttons. */
  mcpLaunch: McpLaunch
  /**
   * Says the bridge could not be installed, in the language the window is in. A dialog and not a
   * log line: nothing else answers this button, so a silent failure is one nobody finds out about.
   */
  onResolveMissing: () => void
}

/**
 * What the buttons of the settings window do. Kept apart from the handlers: each one reaches
 * straight into Electron, and the handler that routes them stays testable without it.
 */
export function runSettingAction({
  settings,
  settingsPath,
  logFile,
  mcpLaunch,
  onResolveMissing,
}: ActionDeps) {
  return (id: SettingActionId): void => {
    switch (id) {
      case 'advanced.openLogFolder':
        // Revealed rather than opened, as the settings file above: what a reader wants is the
        // folder, since a rotation leaves a second file beside the current one.
        shell.showItemInFolder(logFile())
        return

      case 'advanced.openSettingsFile':
        // Revealed rather than opened: the file is JSON, and whatever the OS opens it with is
        // less useful than seeing where it sits — next to the rest of the profile.
        shell.showItemInFolder(settingsPath())
        return

      case 'advanced.openDevtools':
        BrowserWindow.getFocusedWindow()?.webContents.openDevTools({ mode: 'detach' })
        return

      // Copied whether the way in is open or shut, which it could not be while what was copied
      // carried a live port: someone configures their client first and ticks the switch after.
      case 'mcp.copyCommand':
        clipboard.writeText(mcpAddCommand(mcpLaunch, clientName(APP_NAME)))
        return

      case 'mcp.copyConfig':
        clipboard.writeText(mcpConfigJson(mcpLaunch, clientName(APP_NAME)))
        return

      case 'advanced.installResolveBridge':
        // Revealed once written, which is the whole of the feedback: a file dropped in another
        // application's folder that nobody is shown is a file nobody trusts. And SAID when it
        // could not be — no Resolve on this machine is the ordinary case, not a fault to log.
        void installResolveScript(homedir(), process.platform).then(
          written => shell.showItemInFolder(written),
          (error: unknown) => {
            log.error('resolve bridge', String(error))
            onResolveMissing()
          },
        )
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

import { BrowserWindow, clipboard, shell } from 'electron'
import { APP_NAME } from '@shared/constants'
import type { SettingActionId } from '@shared/domain/settingsRegistry'
import { installResolveScript } from '@main/bridge/resolveBridge'
import { log } from '@main/log'
import { mcpAddCommand, type McpEndpoint } from '@main/mcp/endpoint'
import type { SettingsStore } from './store'

export type ActionDeps = {
  settings: SettingsStore
  /** Where the settings file lives, so it can be revealed without guessing the path. */
  settingsPath: () => string
  /** Where `main.log` lives — the folder Electron hands out, not one this side works out. */
  logFile: () => string
  /** Where the MCP server is listening, or `null` while it is off. */
  mcpEndpoint: () => McpEndpoint | null
}

/**
 * What the buttons of the settings window do. Kept apart from the handlers: each one reaches
 * straight into Electron, and the handler that routes them stays testable without it.
 */
export function runSettingAction({ settings, settingsPath, logFile, mcpEndpoint }: ActionDeps) {
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

      case 'advanced.copyMcpCommand': {
        // Nothing to copy while the server is off, and nothing to say about it either: the
        // button sits under the switch that turns it on, which is the answer.
        const endpoint = mcpEndpoint()
        if (endpoint) clipboard.writeText(mcpAddCommand(endpoint, APP_NAME.toLowerCase()))
        return
      }

      case 'advanced.installResolveBridge':
        // Revealed once written, which is the whole of the feedback: the window is told nothing,
        // and a file dropped in another application's folder that nobody is shown is a file
        // nobody trusts. A failure lands in the main log, where every other one does.
        void installResolveScript().then(
          written => shell.showItemInFolder(written),
          (error: unknown) => log.error('resolve bridge', String(error)),
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

import { app, BrowserWindow, Menu } from 'electron'
import { DEFAULT_WORKSPACE, type WorkspaceId } from '@shared/domain/workspace'
import { resolveLanguage, type Language } from '@shared/i18n'
import { CHANNELS } from '@shared/ipc'
import { handle } from '@main/ipc/handle'
import { toggleFullScreen } from '@main/window/controls'
import { openSettingsWindow } from '@main/window/windows'
import { menuTemplate } from './template'

/**
 * The native menu belongs to the focused window. Broadcasting would run Cmd-N in every window
 * at once — the very "two windows holding the same document" trap listed in CLAUDE.md.
 *
 * On macOS the app outlives its last window, so the menu stays usable with nothing focused;
 * we fall back to the first live window rather than dropping the command in silence.
 */
function sendToFocused(channel: string, payload?: unknown): void {
  const target = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  if (!target || target.isDestroyed()) return
  target.webContents.send(channel, payload)
}

/**
 * The menu is rebuilt whenever the workspace changes, so what it last showed has to be
 * remembered here: the renderer announces the workspace, and nothing else knows the language.
 */
const language: Language = resolveLanguage(app.getLocale())
let workspace: WorkspaceId = DEFAULT_WORKSPACE

/**
 * Native application menu. Together with the icon rails, it is one of the two ways back for a
 * tool removed with its close button — a panel closed with no way to reopen it would be lost.
 */
export function buildMenu(): void {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate(
      menuTemplate(language, workspace, process.platform === 'darwin', {
        appName: app.name,
        openSettings: () => void openSettingsWindow(),
        toggleFullScreen: () => toggleFullScreen(BrowserWindow.getFocusedWindow()),
        send: sendToFocused,
        developerTools: !app.isPackaged,
      }),
    ),
  )
}

/**
 * The menu shows what the active workspace can do, and only the renderer knows which one that
 * is. The renderer announces the restored workspace on startup and re-announces it on every
 * click of the space rail, including the space already up — hence the guard.
 */
export function registerMenuHandlers(): void {
  handle(CHANNELS.windowWorkspace, (_event, next) => {
    if (next === workspace) return
    workspace = next
    buildMenu()
  })
}

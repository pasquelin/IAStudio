import { app, BrowserWindow, dialog, Menu, nativeImage } from 'electron'
import { type Language } from '@shared/i18n'
import { aboutInfo } from '@main/about'
import { runtimeVersions } from '@main/about-panel'
import { APP_ICON_PATH } from '@main/resources'
import { toggleFullScreen } from '@main/window/controls'
import { openSettingsWindow } from '@main/window/windows'
import { menuTemplate } from './template'

/**
 * The native menu belongs to the focused window. Broadcasting would run ⌘N in every window at
 * once — the very "two windows holding the same document" trap listed in CLAUDE.md.
 *
 * On macOS the app outlives its last window, so the menu stays usable with nothing focused;
 * we fall back to the first live window rather than dropping the command in silence.
 */
function sendToFocused(channel: string, payload?: unknown): void {
  const target = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  if (!target || target.isDestroyed()) return
  target.webContents.send(channel, payload)
}

/** Windows has no About panel role: a message box is the only way the version is reachable. */
function showAboutDialog(language: Language): void {
  const info = aboutInfo(language, runtimeVersions())
  void dialog.showMessageBox({
    type: 'none',
    icon: nativeImage.createFromPath(APP_ICON_PATH),
    title: info.applicationName,
    message: `${info.applicationName} ${info.applicationVersion}`,
    detail: `${info.version}\n${info.credits}\n\n${info.copyright}`,
  })
}

export function buildMenu(language: Language): void {
  const template = menuTemplate({
    language,
    isMac: process.platform === 'darwin',
    isPackaged: app.isPackaged,
    appName: app.name,
    actions: {
      send: sendToFocused,
      openSettings: () => void openSettingsWindow(),
      toggleFullScreen: () => toggleFullScreen(BrowserWindow.getFocusedWindow()),
      showAbout: () => showAboutDialog(language),
    },
  })

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

import { app, BrowserWindow, Menu } from 'electron'
import { type Language } from '@shared/i18n'
import { toggleFullScreen } from '@main/window/controls'
import { openSettingsWindow } from '@main/window/windows'
import { menuTemplate } from './template'

/**
 * The native menu belongs to the focused window. Broadcasting would run ⌘N in every window at
 * once — the very "two windows holding the same document" trap listed in CLAUDE.md.
 *
 * On macOS the app outlives its last window, so the menu stays usable with nothing focused;
 * we fall back to the first live window rather than dropping the command in silence. The
 * splash is skipped by `isFocusable`: it has no bridge, so a command sent there is lost.
 */
function applicationWindows(): BrowserWindow[] {
  return BrowserWindow.getAllWindows().filter(window => window.isFocusable())
}

function sendToFocused(channel: string, payload?: unknown): void {
  const target = BrowserWindow.getFocusedWindow() ?? applicationWindows()[0]
  if (!target || target.isDestroyed()) return
  target.webContents.send(channel, payload)
}

export function buildMenu(language: Language): void {
  const template = menuTemplate({
    language,
    isMac: process.platform === 'darwin',
    isPackaged: app.isPackaged,
    actions: {
      send: sendToFocused,
      openSettings: () => void openSettingsWindow(),
      toggleFullScreen: () => toggleFullScreen(BrowserWindow.getFocusedWindow()),
    },
  })

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

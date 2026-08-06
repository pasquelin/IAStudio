import { app, BrowserWindow, Menu, type MenuItemConstructorOptions } from 'electron'
import { TRANSLATIONS, type Language } from '@shared/i18n'
import { TOOL_PLACEMENTS } from '@shared/domain/tool'
import { EVENTS } from '@shared/ipc'
import { toggleFullScreen } from '@main/window/controls'
import { openSettingsWindow } from '@main/window/windows'

/**
 * The renderer console reaches `window.studio` directly: shipping DevTools in a packaged
 * build hands an attacker `setCredentials` through a self-XSS.
 */
function developerItems(): MenuItemConstructorOptions[] {
  if (app.isPackaged) return []
  return [{ type: 'separator' }, { role: 'toggleDevTools' }, { role: 'reload' }]
}

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

/**
 * Native application menu. Together with the icon rails, it is one of the two ways back for a
 * tool removed with its close button — a panel closed with no way to reopen it would be lost.
 */
export function buildMenu(language: Language): void {
  const t = TRANSLATIONS[language]
  const isMac = process.platform === 'darwin'

  // Opened by the main process rather than routed through a renderer: settings are a window
  // now, and which window is focused has nothing to do with it.
  const settingsItem: MenuItemConstructorOptions = {
    label: t.menu.settings,
    accelerator: 'CmdOrCtrl+,',
    click: () => void openSettingsWindow(),
  }

  // Spelled out rather than `role: 'appMenu'`: the built-in role has no Preferences entry,
  // and ⌘, is where every macOS user looks for it first.
  const appMenuItem: MenuItemConstructorOptions = {
    label: app.name,
    submenu: [
      { role: 'about' },
      { type: 'separator' },
      settingsItem,
      { type: 'separator' },
      { role: 'services' },
      { type: 'separator' },
      { role: 'hide' },
      { role: 'hideOthers' },
      { role: 'unhide' },
      { type: 'separator' },
      { role: 'quit' },
    ],
  }

  // Outside macOS there is no application menu: Settings belongs under File instead.
  const fileMenuSettings: MenuItemConstructorOptions[] = isMac
    ? []
    : [settingsItem, { type: 'separator' }]

  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [appMenuItem] : []),
    {
      label: t.menu.file,
      submenu: [
        {
          label: t.menu.newProject,
          accelerator: 'CmdOrCtrl+N',
          click: () => sendToFocused(EVENTS.menuCommand, 'project:new'),
        },
        {
          label: t.menu.openProject,
          accelerator: 'CmdOrCtrl+O',
          click: () => sendToFocused(EVENTS.menuCommand, 'project:open'),
        },
        { type: 'separator' },
        ...fileMenuSettings,
        { role: isMac ? 'close' : 'quit' },
      ],
    },
    { role: 'editMenu', label: t.menu.edit },
    {
      label: t.menu.view,
      submenu: [
        {
          label: t.menu.tools,
          submenu: TOOL_PLACEMENTS.map(placement => ({
            label: t.panels[placement.id],
            click: () =>
              sendToFocused(EVENTS.openTool, { zone: placement.zone, tool: placement.id }),
          })),
        },
        {
          label: t.menu.resetLayout,
          click: () => sendToFocused(EVENTS.menuCommand, 'layout:reset'),
        },
        { type: 'separator' },
        {
          label: t.menu.fullScreen,
          accelerator: process.platform === 'darwin' ? 'Ctrl+Cmd+F' : 'F11',
          click: () => toggleFullScreen(BrowserWindow.getFocusedWindow()),
        },
        ...developerItems(),
      ],
    },
    { role: 'windowMenu', label: t.menu.window },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

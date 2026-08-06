import { app, BrowserWindow, Menu, type MenuItemConstructorOptions } from 'electron'
import { TRANSLATIONS, type Language } from '@shared/i18n'
import { TOOL_PLACEMENTS } from '@shared/domain/tool'
import { EVENTS } from '@shared/ipc'
import { toggleFullScreen } from '@main/window/controls'

/**
 * The native menu belongs to the focused window. Broadcasting would run ⌘N in every window at
 * once — the very "two windows holding the same document" trap listed in CLAUDE.md.
 */
function sendToFocused(channel: string, payload?: unknown): void {
  BrowserWindow.getFocusedWindow()?.webContents.send(channel, payload)
}

/**
 * Native application menu. It is the only way back for a tool removed with its close button:
 * a panel closed with no way to reopen it would be a panel lost.
 */
export function buildMenu(language: Language): void {
  const t = TRANSLATIONS[language]
  const appMenuItem: MenuItemConstructorOptions = { role: 'appMenu', label: app.name }

  const template: MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin' ? [appMenuItem] : []),
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
        { role: process.platform === 'darwin' ? 'close' : 'quit' },
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
        { type: 'separator' },
        { role: 'toggleDevTools' },
        { role: 'reload' },
      ],
    },
    { role: 'windowMenu', label: t.menu.window },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

import { app, BrowserWindow, Menu, type MenuItemConstructorOptions } from 'electron'
import { TRANSLATIONS, type Language } from '@shared/i18n'
import { EVENTS } from '@shared/ipc'
import { toggleFullScreen } from '@main/window/controls'

/**
 * Tools restorable from the menu. A mirror of the renderer registry, deliberately frozen
 * here: the main process does not load renderer code, and this list rarely moves.
 */
const RESTORABLE_TOOLS: readonly { id: string; zone: string }[] = [
  { id: 'explorer', zone: 'left' },
  { id: 'generator', zone: 'right' },
  { id: 'assets', zone: 'bottom' },
  { id: 'jobs', zone: 'bottom' },
]

function broadcast(channel: string, payload: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) window.webContents.send(channel, payload)
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
          click: () => broadcast(EVENTS.menuCommand, 'project:new'),
        },
        {
          label: t.menu.openProject,
          accelerator: 'CmdOrCtrl+O',
          click: () => broadcast(EVENTS.menuCommand, 'project:open'),
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
          submenu: RESTORABLE_TOOLS.map(tool => ({
            label: t.panels[tool.id as keyof typeof t.panels],
            click: () => broadcast(EVENTS.openTool, { zone: tool.zone, tool: tool.id }),
          })),
        },
        {
          label: t.menu.resetLayout,
          click: () => broadcast(EVENTS.menuCommand, 'layout:reset'),
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

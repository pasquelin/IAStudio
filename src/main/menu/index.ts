import { app, BrowserWindow, Menu, type MenuItemConstructorOptions } from 'electron'
import { TRANSLATIONS, type Language } from '@shared/i18n'
import { EVENTS } from '@shared/ipc'
import { toggleFullScreen } from '@main/window/controls'

/**
 * Outils restaurables depuis le menu. Miroir du registre du renderer, volontairement figé
 * ici : le main ne charge pas le code du renderer, et cette liste bouge rarement.
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
 * Menu applicatif natif. Il est la seule voie de retour d'un module retiré par sa croix :
 * un panneau fermé sans moyen de le rouvrir serait un panneau perdu.
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

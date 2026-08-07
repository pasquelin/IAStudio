// `import type`, not `import { type … }`: with verbatimModuleSyntax the latter keeps a runtime
// import of Electron, and this module could no longer be tested under plain Node.
import type { MenuItemConstructorOptions } from 'electron'
import { TRANSLATIONS, type Language } from '@shared/i18n'
import { TOOL_PLACEMENTS } from '@shared/domain/tool'
import { EVENTS } from '@shared/ipc'

/** What the menu can do, injected so the template stays a pure function of its options. */
export type MenuActions = {
  send: (channel: string, payload?: unknown) => void
  openSettings: () => void
  toggleFullScreen: () => void
  showAbout: () => void
}

export type MenuOptions = {
  language: Language
  isMac: boolean
  isPackaged: boolean
  appName: string
  actions: MenuActions
}

/**
 * The renderer console reaches `window.studio` directly: shipping DevTools in a packaged
 * build hands an attacker `setCredentials` through a self-XSS.
 */
function developerItems(isPackaged: boolean): MenuItemConstructorOptions[] {
  if (isPackaged) return []
  return [{ type: 'separator' }, { role: 'toggleDevTools' }, { role: 'reload' }]
}

/**
 * Native menu layout. Together with the icon rails, it is one of the two ways back for a tool
 * removed with its close button — a panel closed with no way to reopen it would be lost.
 */
export function menuTemplate(options: MenuOptions): MenuItemConstructorOptions[] {
  const { language, isMac, isPackaged, appName, actions } = options
  const t = TRANSLATIONS[language]

  // Opened by the main process rather than routed through a renderer: settings are a window
  // now, and which window is focused has nothing to do with it.
  const settingsItem: MenuItemConstructorOptions = {
    label: t.menu.settings,
    accelerator: 'CmdOrCtrl+,',
    click: () => actions.openSettings(),
  }

  // Spelled out rather than `role: 'appMenu'`: the built-in role has no Preferences entry,
  // and ⌘, is where every macOS user looks for it first.
  const appMenuItem: MenuItemConstructorOptions = {
    label: appName,
    submenu: [
      { role: 'about', label: t.menu.about },
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

  // `role: 'about'` does nothing on Windows, and there is no application menu to host it:
  // a Help menu opening a dialog is the only way the version stays reachable there.
  const helpMenu: MenuItemConstructorOptions[] = isMac
    ? []
    : [{ label: t.menu.help, submenu: [{ label: t.menu.about, click: () => actions.showAbout() }] }]

  return [
    ...(isMac ? [appMenuItem] : []),
    {
      label: t.menu.file,
      submenu: [
        {
          label: t.menu.newProject,
          accelerator: 'CmdOrCtrl+N',
          click: () => actions.send(EVENTS.menuCommand, 'project:new'),
        },
        {
          label: t.menu.openProject,
          accelerator: 'CmdOrCtrl+O',
          click: () => actions.send(EVENTS.menuCommand, 'project:open'),
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
              actions.send(EVENTS.openTool, { zone: placement.zone, tool: placement.id }),
          })),
        },
        {
          label: t.menu.resetLayout,
          click: () => actions.send(EVENTS.menuCommand, 'layout:reset'),
        },
        { type: 'separator' },
        {
          label: t.menu.fullScreen,
          accelerator: isMac ? 'Ctrl+Cmd+F' : 'F11',
          click: () => actions.toggleFullScreen(),
        },
        ...developerItems(isPackaged),
      ],
    },
    { role: 'windowMenu', label: t.menu.window },
    ...helpMenu,
  ]
}

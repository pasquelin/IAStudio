import type { MenuItemConstructorOptions } from 'electron'
import { LIGHT_ENTRIES, MESH_ENTRIES, type SceneEntry } from '@shared/domain/scene'
import { TOOL_PLACEMENTS } from '@shared/domain/tool'
import type { WorkspaceId } from '@shared/domain/workspace'
import { TRANSLATIONS, type Language } from '@shared/i18n'
import { EVENTS } from '@shared/ipc'

/**
 * What the template cannot know on its own. Passed in rather than reached for, so the whole
 * menu is a pure function of a language and a workspace — which is what makes it testable
 * without an Electron runtime.
 */
export type MenuActions = {
  appName: string
  openSettings: () => void
  toggleFullScreen: () => void
  /** Sends to the focused window. Broadcasting would add a cube in every open window. */
  send: (channel: string, payload?: unknown) => void
  /**
   * The renderer console reaches `window.studio` directly: shipping DevTools in a packaged
   * build hands an attacker `setCredentials` through a self-XSS.
   */
  developerTools: boolean
}

export function menuTemplate(
  language: Language,
  workspace: WorkspaceId,
  isMac: boolean,
  actions: MenuActions,
): MenuItemConstructorOptions[] {
  const t = TRANSLATIONS[language]

  // Opened by the main process rather than routed through a renderer: settings are a window
  // now, and which window is focused has nothing to do with it.
  const settingsItem: MenuItemConstructorOptions = {
    label: t.menu.settings,
    accelerator: 'CmdOrCtrl+,',
    click: actions.openSettings,
  }

  // Spelled out rather than `role: 'appMenu'`: the built-in role has no Preferences entry,
  // and Cmd-, is where every macOS user looks for it first.
  const appMenuItem: MenuItemConstructorOptions = {
    label: actions.appName,
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

  const entryItem =
    (labels: Record<string, string>) =>
    (entry: SceneEntry<string>): MenuItemConstructorOptions => ({
      label: labels[entry.kind] ?? entry.kind,
      enabled: !entry.disabled,
      click: () => actions.send(EVENTS.sceneAdd, { kind: entry.kind }),
    })

  /** Only where a scene is what is being edited: an Add menu elsewhere would add nothing. */
  const addMenu: MenuItemConstructorOptions[] =
    workspace === '3d'
      ? [
          {
            label: t.menu.add,
            submenu: [
              { label: t.menu.mesh, submenu: MESH_ENTRIES.map(entryItem(t.meshes)) },
              { label: t.menu.light, submenu: LIGHT_ENTRIES.map(entryItem(t.lights)) },
            ],
          },
        ]
      : []

  const developerItems: MenuItemConstructorOptions[] = actions.developerTools
    ? [{ type: 'separator' }, { role: 'toggleDevTools' }, { role: 'reload' }]
    : []

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
    ...addMenu,
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
          click: actions.toggleFullScreen,
        },
        ...developerItems,
      ],
    },
    { role: 'windowMenu', label: t.menu.window },
  ]
}

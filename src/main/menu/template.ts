import type { MenuItemConstructorOptions } from 'electron'
import {
  LIGHT_ENTRIES,
  MESH_ENTRIES,
  type LightKind,
  type MeshKind,
  type SceneEntry,
} from '@shared/domain/scene'
import { TOOL_PLACEMENTS } from '@shared/domain/tool'
import type { WorkspaceId } from '@shared/domain/workspace'
import { TRANSLATIONS, type Language } from '@shared/i18n'
import type { MenuCommand, SceneAddRequest, ToolRequest } from '@shared/ipc'

/**
 * What the menu asks of the window it belongs to. One method per message rather than a
 * `send(channel, payload)`: `shared/ipc.ts` types both ends of every channel, and a generic
 * sender is the one hop where that guarantee would stop.
 */
export type MenuActions = {
  openSettings: () => void
  toggleFullScreen: () => void
  openTool: (request: ToolRequest) => void
  runCommand: (command: MenuCommand) => void
  addNode: (request: SceneAddRequest) => void
}

/**
 * Everything the template cannot know on its own. Passed in rather than reached for, so the
 * whole menu is a pure function of its context — which is what makes it testable without an
 * Electron runtime.
 */
export type MenuContext = {
  language: Language
  /** `null` when the focused window edits no workspace at all — the settings window. */
  workspace: WorkspaceId | null
  isMac: boolean
  appName: string
  /**
   * The renderer console reaches `window.studio` directly: shipping DevTools in a packaged
   * build hands an attacker `setCredentials` through a self-XSS.
   */
  developerTools: boolean
  actions: MenuActions
}

export function menuTemplate({
  language,
  workspace,
  isMac,
  appName,
  developerTools,
  actions,
}: MenuContext): MenuItemConstructorOptions[] {
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
    label: appName,
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
    <K extends MeshKind | LightKind>(labels: Record<K, string>) =>
    (entry: SceneEntry<K>): MenuItemConstructorOptions => ({
      label: labels[entry.kind],
      enabled: !entry.disabled,
      click: () => actions.addNode({ kind: entry.kind }),
    })

  /** Only where a scene is what is being edited: an Add menu elsewhere would add nothing. */
  const addMenu: MenuItemConstructorOptions[] =
    workspace === '3d'
      ? [
          {
            label: t.menu.add,
            submenu: [
              { label: t.menu.mesh, submenu: MESH_ENTRIES.map(entryItem<MeshKind>(t.meshes)) },
              { label: t.menu.light, submenu: LIGHT_ENTRIES.map(entryItem<LightKind>(t.lights)) },
            ],
          },
        ]
      : []

  const developerItems: MenuItemConstructorOptions[] = developerTools
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
          click: () => actions.runCommand('project:new'),
        },
        {
          label: t.menu.openProject,
          accelerator: 'CmdOrCtrl+O',
          click: () => actions.runCommand('project:open'),
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
            click: () => actions.openTool({ zone: placement.zone, tool: placement.id }),
          })),
        },
        {
          label: t.menu.resetLayout,
          click: () => actions.runCommand('layout:reset'),
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

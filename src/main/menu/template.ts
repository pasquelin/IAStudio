// `import type`, not `import { type … }`: with verbatimModuleSyntax the latter keeps a runtime
// import of Electron, and this module could no longer be tested under plain Node.
import type { MenuItemConstructorOptions } from 'electron'
import { APP_NAME } from '@shared/constants'
import {
  LIGHT_ENTRIES,
  MESH_ENTRIES,
  type LightKind,
  type MeshKind,
  type SceneEntry,
} from '@shared/domain/scene'
import { TOOL_PLACEMENTS } from '@shared/domain/tool'
import type { WorkspaceId } from '@shared/domain/workspace'
import { bindingOf, type BindingOverrides, type CommandId } from '@shared/domain/command'
import { acceleratorOf } from '@shared/domain/shortcut'
import { TRANSLATIONS, type Language } from '@shared/i18n'
import type { SceneAddRequest, ToolRequest } from '@shared/ipc'

/**
 * What the menu asks of the window it belongs to. One method per message rather than a
 * `send(channel, payload)`: `shared/ipc.ts` types both ends of every channel, and a generic
 * sender is the one hop where that guarantee would stop.
 */
export type MenuActions = {
  openSettings: () => void
  toggleFullScreen: () => void
  openTool: (request: ToolRequest) => void
  runCommand: (command: CommandId) => void
  addNode: (request: SceneAddRequest) => void
}

/**
 * Everything the template cannot know on its own. Passed in rather than reached for, so the
 * whole menu is a pure function of its options — which is what makes it testable without an
 * Electron runtime.
 */
export type MenuOptions = {
  language: Language
  /** `null` when the focused window edits no workspace at all — the settings window. */
  workspace: WorkspaceId | null
  isMac: boolean
  isPackaged: boolean
  /** What the user remapped, so the menu advertises the key it will actually answer to. */
  overrides: BindingOverrides
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
  const { language, workspace, isMac, isPackaged, overrides, actions } = options

  /**
   * The accelerator of a command, read off the registry. Written by hand until now, which is
   * how the menu kept advertising a key a remapped command no longer answered to — and how a
   * command could be fired by a shortcut the menu never mentioned.
   */
  const shortcut = (command: CommandId): string | undefined =>
    acceleratorOf(bindingOf(command, overrides))
  const t = TRANSLATIONS[language]

  // Interpolated rather than spelled out in both bundles: `constants.test.ts` pins the product
  // name to one place, and a hard-coded copy here would drift past it unnoticed.
  const aboutLabel = t.menu.about.replace('{{name}}', APP_NAME)

  // Opened by the main process rather than routed through a renderer: settings are a window
  // now, and which window is focused has nothing to do with it.
  const settingsItem: MenuItemConstructorOptions = {
    label: t.menu.settings,
    accelerator: shortcut('app.settings'),
    click: () => actions.openSettings(),
  }

  // Spelled out rather than `role: 'appMenu'`: the built-in role has no Preferences entry,
  // and ⌘, is where every macOS user looks for it first.
  const appMenuItem: MenuItemConstructorOptions = {
    label: APP_NAME,
    submenu: [
      { role: 'about', label: aboutLabel },
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

  // Windows and Linux have no application menu to host About; Electron renders the panel
  // itself on both, from `setAboutPanelOptions`, so the role is all that is needed.
  const helpMenu: MenuItemConstructorOptions[] = isMac
    ? []
    : [{ label: t.menu.help, submenu: [{ role: 'about', label: aboutLabel }] }]

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

  return [
    ...(isMac ? [appMenuItem] : []),
    {
      label: t.menu.file,
      submenu: [
        {
          label: t.menu.newProject,
          accelerator: shortcut('project.new'),
          click: () => actions.runCommand('project.new'),
        },
        {
          label: t.menu.openProject,
          accelerator: shortcut('project.open'),
          click: () => actions.runCommand('project.open'),
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
          accelerator: shortcut('layout.reset'),
          click: () => actions.runCommand('layout.reset'),
        },
        { type: 'separator' },
        {
          label: t.menu.fullScreen,
          accelerator: shortcut('window.fullScreen'),
          click: () => actions.toggleFullScreen(),
        },
        ...developerItems(isPackaged),
      ],
    },
    { role: 'windowMenu', label: t.menu.window },
    ...helpMenu,
  ]
}

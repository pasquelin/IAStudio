// `import type`, not `import { type … }`: with verbatimModuleSyntax the latter keeps a runtime
// import of Electron, and this module could no longer be tested under plain Node.
import type { MenuItemConstructorOptions } from 'electron'
import { APP_NAME } from '@shared/constants'
import {
  LIGHT_ENTRIES,
  EXPORT_FORMATS,
  MESH_ENTRIES,
  OBJECT_ENTRIES,
  type LightKind,
  type MeshKind,
  type ObjectKind,
  type SceneEntry,
} from '@shared/domain/scene'
import { placementIn, type ToolId, type ToolPlacement } from '@shared/domain/tool'
import type { WorkspaceId } from '@shared/domain/workspace'
import {
  bindingOf,
  commandIn,
  scopeOfWorkspace,
  type BindingOverrides,
  type CommandId,
} from '@shared/domain/command'
import { acceleratorOf } from '@shared/domain/shortcut'
import { TRANSLATIONS, type Language, type Translations } from '@shared/i18n'
import { TEXTURE_EXPORT_TARGETS } from '@shared/domain/texture-export'
import { FACE_SIZES } from '@shared/domain/skybox'
import type {
  SceneAddRequest,
  SceneExportCommand,
  SkyboxExportCommand,
  TextureExportCommand,
  ToolRequest,
} from '@shared/ipc'

/**
 * What the menu asks of the window it belongs to. One method per message rather than a
 * `send(channel, payload)`: `shared/ipc.ts` types both ends of every channel, and a generic
 * sender is the one hop where that guarantee would stop.
 */
export type MenuActions = {
  openSettings: () => void
  openLicences: () => void
  openUsage: () => void
  toggleFullScreen: () => void
  openTool: (request: ToolRequest) => void
  runCommand: (command: CommandId) => void
  addNode: (request: SceneAddRequest) => void
  exportScene: (command: SceneExportCommand) => void
  exportTexture: (command: TextureExportCommand) => void
  exportSkybox: (command: SkyboxExportCommand) => void
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
  /**
   * The panels the focused window can currently open, as it reported them. Not derived from the
   * registry here: whether the generator exists depends on a model being chosen, which only the
   * renderer knows.
   */
  tools: readonly ToolId[]
  isMac: boolean
  isDevelopment: boolean
  /** What the user remapped, so the menu advertises the key it will actually answer to. */
  overrides: BindingOverrides
  actions: MenuActions
}

/**
 * A native role the studio labels itself.
 *
 * Electron writes role labels as English literals in `roleList` — "Cut", "Select All" — and
 * consults no locale, so an unlabelled role reads English everywhere. The label is only a
 * default there: `accelerator`, `registerAccelerator` and the click all derive from the role,
 * which is why naming one changes nothing but the word.
 *
 * Keyed by the role itself rather than through a table: `menu.cut` IS the label of `cut`, so a
 * role without a translation fails to compile instead of waiting for a test to say so.
 */
type LabelledRole = keyof Translations['menu'] & NonNullable<MenuItemConstructorOptions['role']>

/**
 * The renderer console reaches `window.studio` directly: shipping DevTools in a packaged
 * build hands an attacker `setCredentials` through a self-XSS.
 */
function developerItems(
  isDevelopment: boolean,
  roleItem: (role: LabelledRole) => MenuItemConstructorOptions,
): MenuItemConstructorOptions[] {
  if (!isDevelopment) return []
  return [
    { type: 'separator' },
    roleItem('toggleDevTools'),
    // ⌘R is the image workspace's rulers, and `role: 'reload'` carries ⌘R implicitly: two items
    // of this very submenu would claim one key, and AppKit serves whichever it finds first.
    { ...roleItem('reload'), accelerator: 'Shift+CmdOrCtrl+R' },
  ]
}

/**
 * Where each reported panel sits in this section. A window that announced no workspace — the
 * settings window, the splash — gets nothing: there is no column to open a panel into.
 */
function placementsFor(tools: readonly ToolId[], workspace: WorkspaceId | null): ToolPlacement[] {
  if (!workspace) return []
  return tools.flatMap(id => placementIn(id, workspace) ?? [])
}

/**
 * Native menu layout. Together with the icon rails, it is one of the two ways back for a tool
 * removed with its close button — a panel closed with no way to reopen it would be lost.
 */
export function menuTemplate(options: MenuOptions): MenuItemConstructorOptions[] {
  const { language, workspace, tools, isMac, isDevelopment, overrides, actions } = options

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
  const named = (sentence: string): string => sentence.replace('{{name}}', APP_NAME)
  const aboutLabel = named(t.menu.about)

  // `named` rides along: only `hide` and `quit` carry a placeholder, and a sentence without one
  // comes back untouched.
  const roleItem = (role: LabelledRole): MenuItemConstructorOptions => ({
    role,
    label: named(t.menu[role]),
  })

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
      roleItem('services'),
      { type: 'separator' },
      roleItem('hide'),
      roleItem('hideOthers'),
      roleItem('unhide'),
      { type: 'separator' },
      roleItem('quit'),
    ],
  }

  // Outside macOS there is no application menu: Settings belongs under File instead.
  const fileMenuSettings: MenuItemConstructorOptions[] = isMac
    ? []
    : [settingsItem, { type: 'separator' }]

  const licencesItem: MenuItemConstructorOptions = {
    label: t.menu.licences,
    click: () => actions.openLicences(),
  }

  const usageItem: MenuItemConstructorOptions = {
    label: t.menu.usage,
    click: () => actions.openUsage(),
  }

  // On macOS About lives in the application menu; Help exists here for the licences alone,
  // which is where every macOS application keeps its notice.
  const helpMenu: MenuItemConstructorOptions[] = [
    {
      label: t.menu.help,
      submenu: isMac
        ? [usageItem, { type: 'separator' }, licencesItem]
        : [{ role: 'about', label: aboutLabel }, usageItem, { type: 'separator' }, licencesItem],
    },
  ]

  const entryItem =
    <K extends MeshKind | LightKind | ObjectKind>(labels: Record<K, string>) =>
    (entry: SceneEntry<K>): MenuItemConstructorOptions => ({
      label: labels[entry.kind],
      enabled: !entry.disabled,
      click: () => actions.addNode({ kind: entry.kind }),
    })

  /** A format per row rather than a chooser: the save dialog has no such control to offer. */
  const exportItems = (scope: 'scene' | 'selection'): MenuItemConstructorOptions[] =>
    EXPORT_FORMATS.map(format => ({
      label: t.exportFormats[format],
      click: () => actions.exportScene({ format, scope }),
    }))

  /** One engine per row, for the same reason a format is one: a dialog has no such control. */
  const textureItems = (): MenuItemConstructorOptions[] =>
    TEXTURE_EXPORT_TARGETS.map(target => ({
      label: t.textureExportTargets[target],
      click: () => actions.exportTexture({ target }),
    }))

  /**
   * One face size per row. A sky has no engine to choose between — six PNGs named `_Rt`…`_Bk` is
   * what all of them read — so what the rows offer is the one thing that does differ.
   */
  const skyboxItems = (): MenuItemConstructorOptions[] =>
    FACE_SIZES.map(size => ({
      label: t.skyboxFaceSize.replace(/\{\{size\}\}/g, String(size)),
      click: () => actions.exportSkybox({ size }),
    }))

  /**
   * Only where the thing being edited is what the rows export. An image document has neither a
   * scene nor a set of channels, and a row that exported nothing would still look like one.
   *
   * Returns rather than a nested ternary: this file's idiom is one flat arm per feature, and
   * there are three exporting spaces now — a ternary would already be a triple.
   */
  const exportMenu = (): MenuItemConstructorOptions[] => {
    if (workspace === '3d') {
      return [
        { type: 'separator' },
        { label: t.menu.exportScene, submenu: exportItems('scene') },
        { label: t.menu.exportSelection, submenu: exportItems('selection') },
      ]
    }

    if (workspace === 'textures') {
      return [{ type: 'separator' }, { label: t.menu.exportTexture, submenu: textureItems() }]
    }

    if (workspace === 'skyboxes') {
      return [{ type: 'separator' }, { label: t.menu.exportSkybox, submenu: skyboxItems() }]
    }

    return []
  }

  /**
   * A row that is exactly a command: its label, its accelerator and what it fires all come from
   * the registry, so a title translated once is never translated again for the menu.
   */
  const commandItem = (
    command: CommandId,
    label: string,
    registerAccelerator = true,
  ): MenuItemConstructorOptions => ({
    label,
    accelerator: shortcut(command),
    registerAccelerator,
    click: () => actions.runCommand(command),
  })

  /**
   * Built by hand rather than `role: 'editMenu'`, and the reason is ⌘Z.
   *
   * A native role registers its accelerator with the system: AppKit then serves the key to the
   * menu and the window never sees it. Undo, Redo, Cut, Copy and Paste were all swallowed that
   * way — `canvas.undo`, `scene.undo` and `sequence.undo` could not be reached by keyboard in
   * any of the three spaces, and the studio read as an application without undo.
   *
   * Undo and Redo are ordinary command rows now: the menu catches the key and hands the command
   * to the surface in front. The clipboard keeps its native roles — a text field must go on
   * copying — but with `registerAccelerator: false`, so the key reaches the window and
   * `useShortcuts` decides: highlighted text keeps ⌘C, everything else is the scene's.
   */
  // Where no history exists, the platform keeps the keys — its own undo is the only one there is.
  const nativeHistory: MenuItemConstructorOptions[] = [
    { role: 'undo', label: t.commands.undo.title },
    { role: 'redo', label: t.commands.redo.title },
  ]
  const surface = scopeOfWorkspace(workspace)
  const undo = surface && commandIn(surface, 'undo')
  const redo = surface && commandIn(surface, 'redo')

  const editMenu: MenuItemConstructorOptions = {
    label: t.menu.edit,
    submenu: [
      ...(undo && redo
        ? [
            // The key is shown but not reserved, exactly as for the clipboard below: reserving it
            // would take ⌘Z away from a field being typed into, and undo a brush stroke instead of
            // the word just mistyped. Unreserved, the window sees it and `useShortcuts` steps
            // aside whenever the caret is in a text field.
            commandItem(undo, t.commands.undo.title, false),
            commandItem(redo, t.commands.redo.title, false),
          ]
        : nativeHistory),
      { type: 'separator' },
      { ...roleItem('cut'), registerAccelerator: false },
      { ...roleItem('copy'), registerAccelerator: false },
      { ...roleItem('paste'), registerAccelerator: false },
      roleItem('selectAll'),
    ],
  }

  /**
   * The canvas's own view: zoom, rulers, guides, snapping.
   *
   * Their labels had been translated in both bundles and never posted anywhere — eight rows
   * prepared and forgotten. The commands behind them all work; only the way in was missing, and
   * the four that carry no default key had no way in at all.
   */
  const canvasViewMenu: MenuItemConstructorOptions[] =
    workspace === 'image'
      ? [
          { type: 'separator' },
          commandItem('canvas.zoomIn', t.menu.zoomIn),
          commandItem('canvas.zoomOut', t.menu.zoomOut),
          commandItem('canvas.zoomFit', t.menu.zoomFit),
          commandItem('canvas.zoomActual', t.menu.zoomActual),
          { type: 'separator' },
          commandItem('canvas.rulers', t.menu.rulers),
          commandItem('canvas.guides', t.menu.guides),
          commandItem('canvas.clearGuides', t.menu.clearGuides),
          commandItem('canvas.snap', t.menu.snap),
        ]
      : []

  /**
   * Every tool of the image space, in the order the bar stacks them.
   *
   * The bar is where a tool is picked in practice, so this is not the fast path — it is what
   * makes each of them a command: remappable in the settings, listed in the shortcuts screen,
   * and reachable at all for the four that carry no default key.
   */
  const toolsMenu: MenuItemConstructorOptions[] =
    workspace === 'image'
      ? [
          {
            label: t.menu.imageTools,
            submenu: [
              commandItem('canvas.toolMove', t.commands.canvasToolMove.title),
              commandItem('canvas.toolHand', t.commands.canvasToolHand.title),
              commandItem('canvas.toolScale', t.commands.canvasToolScale.title),
              { type: 'separator' },
              commandItem('canvas.toolCrop', t.commands.canvasToolCrop.title),
              { type: 'separator' },
              commandItem('canvas.toolSelectRectangle', t.commands.canvasToolSelectRectangle.title),
              commandItem('canvas.toolSelectEllipse', t.commands.canvasToolSelectEllipse.title),
              commandItem('canvas.toolSelectLasso', t.commands.canvasToolSelectLasso.title),
              { type: 'separator' },
              commandItem('canvas.toolShapeRectangle', t.commands.canvasToolShapeRectangle.title),
              commandItem('canvas.toolShapeLine', t.commands.canvasToolShapeLine.title),
              commandItem('canvas.toolShapeArrow', t.commands.canvasToolShapeArrow.title),
              commandItem('canvas.toolShapeEllipse', t.commands.canvasToolShapeEllipse.title),
              commandItem('canvas.toolShapePolygon', t.commands.canvasToolShapePolygon.title),
              commandItem('canvas.toolShapeStar', t.commands.canvasToolShapeStar.title),
              { type: 'separator' },
              commandItem('canvas.toolBrush', t.commands.canvasToolBrush.title),
              commandItem('canvas.toolPencil', t.commands.canvasToolPencil.title),
              commandItem('canvas.toolEraser', t.commands.canvasToolEraser.title),
              commandItem('canvas.toolEraserSelection', t.commands.canvasToolEraserSelection.title),
              commandItem('canvas.toolFill', t.commands.canvasToolFill.title),
              { type: 'separator' },
              commandItem('canvas.toolText', t.commands.canvasToolText.title),
              commandItem('canvas.toolPicker', t.commands.canvasToolPicker.title),
              { type: 'separator' },
              commandItem('canvas.brushSmaller', t.commands.canvasBrushSmaller.title),
              commandItem('canvas.brushLarger', t.commands.canvasBrushLarger.title),
            ],
          },
        ]
      : []

  /** Only where a picture is what is being edited: turning a scene is another gesture entirely. */
  const imageMenu: MenuItemConstructorOptions[] =
    workspace === 'image'
      ? [
          {
            label: t.menu.image,
            submenu: [
              commandItem('canvas.mergeDown', t.commands.canvasMergeDown.title),
              commandItem('canvas.flatten', t.commands.canvasFlatten.title),
              { type: 'separator' },
              commandItem('canvas.flipHorizontal', t.commands.canvasFlipHorizontal.title),
              commandItem('canvas.flipVertical', t.commands.canvasFlipVertical.title),
              { type: 'separator' },
              commandItem('canvas.rotateCw', t.commands.canvasRotateCw.title),
              commandItem('canvas.rotateCcw', t.commands.canvasRotateCcw.title),
              { type: 'separator' },
              // Implemented, tested, and reachable by nothing at all until now: no default key
              // and no row anywhere.
              commandItem('canvas.maskFromSelection', t.commands.canvasMaskFromSelection.title),
              { type: 'separator' },
              // The only way in: none of the five carries a default shortcut, deliberately —
              // they spend credit, and a key pressed by accident has no business spending any.
              commandItem('canvas.regenerate', t.commands.canvasRegenerate.title),
              commandItem('canvas.extend', t.commands.canvasExtend.title),
              commandItem('canvas.cutout', t.commands.canvasCutout.title),
              commandItem('canvas.enlarge', t.commands.canvasEnlarge.title),
              commandItem('canvas.vectorize', t.commands.canvasVectorize.title),
            ],
          },
        ]
      : []

  /**
   * The one gesture the graph space is for. It lives on a floating bar over the canvas and
   * nowhere else — no menu row, and until now no key — which left the space's main action
   * reachable by pointer alone.
   */
  const graphMenu: MenuItemConstructorOptions[] =
    workspace === 'graph'
      ? [
          {
            label: t.menu.graph,
            submenu: [commandItem('graph.run', t.commands.graphRun.title, false)],
          },
        ]
      : []

  /** Only where a scene is what is being edited: an Add menu elsewhere would add nothing. */
  const addMenu: MenuItemConstructorOptions[] =
    workspace === '3d'
      ? [
          {
            label: t.menu.add,
            submenu: [
              { label: t.menu.mesh, submenu: MESH_ENTRIES.map(entryItem<MeshKind>(t.meshes)) },
              { label: t.menu.light, submenu: LIGHT_ENTRIES.map(entryItem<LightKind>(t.lights)) },
              {
                label: t.menu.object,
                submenu: OBJECT_ENTRIES.map(entryItem<ObjectKind>(t.objects)),
              },
            ],
          },
        ]
      : []

  /**
   * Spelled out rather than left to `role: 'windowMenu'`, which composes this very list out of
   * English literals. Written to match what Electron builds, so the role — and whatever AppKit
   * does with it — sees the same items under our own words.
   */
  const windowMenuTail: MenuItemConstructorOptions[] = isMac
    ? [{ type: 'separator' }, roleItem('front')]
    : [roleItem('close')]
  const windowMenuItems: MenuItemConstructorOptions[] = [
    roleItem('minimize'),
    roleItem('zoom'),
    ...windowMenuTail,
  ]

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
        {
          label: t.menu.saveDocument,
          accelerator: shortcut('document.save'),
          click: () => actions.runCommand('document.save'),
        },
        ...exportMenu(),
        { type: 'separator' },
        ...fileMenuSettings,
        roleItem(isMac ? 'close' : 'quit'),
      ],
    },
    editMenu,
    ...toolsMenu,
    ...imageMenu,
    ...graphMenu,
    ...addMenu,
    {
      label: t.menu.view,
      submenu: [
        {
          label: t.menu.tools,
          // The zone sent here is only a starting point — the window resolves it against the
          // workspace it is actually showing.
          submenu: placementsFor(tools, workspace).map(placement => ({
            label: t.panels[placement.id],
            click: () => actions.openTool({ zone: placement.zone, tool: placement.id }),
          })),
        },
        {
          label: t.menu.resetLayout,
          accelerator: shortcut('layout.reset'),
          click: () => actions.runCommand('layout.reset'),
        },
        ...canvasViewMenu,
        { type: 'separator' },
        {
          label: t.menu.fullScreen,
          accelerator: shortcut('window.fullScreen'),
          click: () => actions.toggleFullScreen(),
        },
        ...developerItems(isDevelopment, roleItem),
      ],
    },
    { role: 'windowMenu', label: t.menu.window, submenu: windowMenuItems },
    ...helpMenu,
  ]
}

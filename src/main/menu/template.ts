// `import type`, not `import { type … }`: with verbatimModuleSyntax the latter keeps a runtime
// import of Electron, and this module could no longer be tested under plain Node.
import type { MenuItemConstructorOptions } from 'electron'
import { APP_NAME } from '@shared/constants'
import {
  DISPLAY_MODES,
  LIGHT_ENTRIES,
  EXPORT_FORMATS,
  MESH_ENTRIES,
  OBJECT_ENTRIES,
  VIEW_DIRECTIONS,
  type DisplayMode,
  type LightKind,
  type MeshKind,
  type ObjectKind,
  type SceneEntry,
  type ViewDirection,
} from '@shared/domain/scene'
import { placementIn, type ToolId, type ToolPlacement, type ToolSurface } from '@shared/domain/tool'
import {
  bindingOf,
  commandIn,
  scopeOfWorkspace,
  type BindingOverrides,
  type CommandId,
  type MenuCheck,
} from '@shared/domain/command'
import { acceleratorOf } from '@shared/domain/shortcut'
import { fillHoles, TRANSLATIONS, type Language, type Translations } from '@shared/i18n'
import { TEXTURE_EXPORT_TARGETS } from '@shared/domain/texture-export'
import { FACE_SIZES } from '@shared/domain/skybox'
import type {
  SceneAddRequest,
  SceneDisplayRequest,
  SceneExportCommand,
  SceneViewRequest,
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
  openManual: () => void
  openUsage: () => void
  toggleFullScreen: () => void
  openTool: (request: ToolRequest) => void
  runCommand: (command: CommandId) => void
  addNode: (request: SceneAddRequest) => void
  viewFrom: (request: SceneViewRequest) => void
  setDisplay: (request: SceneDisplayRequest) => void
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
  /**
   * The surface in front, `null` when the focused window shows none at all — the settings
   * window. `home` is one of them: it edits no document, so every row that belongs to a space
   * drops, which is the whole point of naming the surface rather than the workspace.
   */
  workspace: ToolSurface | null
  /**
   * The panels the focused window can currently open, as it reported them. Not derived from the
   * registry here: whether the generator exists depends on a model being chosen, which only the
   * renderer knows.
   */
  tools: readonly ToolId[]
  isMac: boolean
  isDevelopment: boolean
  /**
   * The rows the focused window reported as ticked. A row that toggles has to say whether it is
   * on, and only the window knows: the state belongs to the document in front.
   */
  checked: readonly MenuCheck[]
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
function placementsFor(tools: readonly ToolId[], workspace: ToolSurface | null): ToolPlacement[] {
  if (!workspace) return []
  return tools.flatMap(id => placementIn(id, workspace) ?? [])
}

/**
 * Native menu layout. Together with the icon rails, it is one of the two ways back for a tool
 * removed with its close button — a panel closed with no way to reopen it would be lost.
 */
export function menuTemplate(options: MenuOptions): MenuItemConstructorOptions[] {
  const { language, workspace, tools, checked, isMac, isDevelopment, overrides, actions } = options

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
  const named = (sentence: string): string => fillHoles(sentence, { name: APP_NAME })
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

  const manualItem: MenuItemConstructorOptions = {
    label: t.menu.manual,
    click: () => actions.openManual(),
  }

  const licencesItem: MenuItemConstructorOptions = {
    label: t.menu.licences,
    click: () => actions.openLicences(),
  }

  const usageItem: MenuItemConstructorOptions = {
    label: t.menu.usage,
    click: () => actions.openUsage(),
  }

  // On macOS About lives in the application menu; Help holds the manual, what has been spent,
  // and the notice — which is where every macOS application keeps the last of the three.
  const helpMenu: MenuItemConstructorOptions[] = [
    {
      label: t.menu.help,
      submenu: isMac
        ? [manualItem, { type: 'separator' }, usageItem, { type: 'separator' }, licencesItem]
        : [
            { role: 'about', label: aboutLabel },
            manualItem,
            { type: 'separator' },
            usageItem,
            { type: 'separator' },
            licencesItem,
          ],
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
      label: fillHoles(t.skyboxFaceSize, { size }),
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

  /**
   * What a scene does to what is selected, once the toolbar stopped drawing a button for each.
   *
   * Only these three, and the omission is deliberate: `scene.copy`, `scene.cut` and
   * `scene.paste` are left to their KEYS ALONE — no bar button, no menu row. The rows above keep
   * their NATIVE roles so a text field goes on copying, and a command row in their place would
   * act on the scene even with the caret in a field: the menu path carries no `isTyping` guard,
   * unlike the keyboard one, which is what makes a key safe here where a row would not be.
   */
  const sceneEditItems: MenuItemConstructorOptions[] =
    workspace === '3d'
      ? [
          { type: 'separator' },
          commandItem('scene.duplicate', t.commands.sceneDuplicate.title),
          commandItem('scene.group', t.commands.sceneGroup.title),
          commandItem('scene.delete', t.commands.sceneDelete.title),
        ]
      : []

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
      ...sceneEditItems,
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

  /** A row that says whether it is on. `checkbox` and not a tick in the label: AppKit draws it. */
  const toggleItem = (command: CommandId, label: string): MenuItemConstructorOptions => ({
    ...commandItem(command, label),
    type: 'checkbox',
    checked: checked.includes(command),
  })

  /** The six sides. An action, not a state: looking from the front leaves nothing turned on. */
  const viewItems = (): MenuItemConstructorOptions[] =>
    VIEW_DIRECTIONS.map((direction: ViewDirection) => ({
      label: t.sceneViews[direction],
      click: () => actions.viewFrom({ direction }),
    }))

  /**
   * The seven ways of drawing, as alternatives — exactly one is true at a time, which is what
   * `radio` says and a row of checkboxes would not.
   *
   * The key that cycles them keeps its own row above: a menu is where one is PICKED, `Z` is how
   * one moves through them, and neither replaces the other.
   */
  const displayItems = (): MenuItemConstructorOptions[] =>
    DISPLAY_MODES.map((mode: DisplayMode) => ({
      label: t.sceneDisplay[mode],
      type: 'radio',
      checked: checked.includes(`scene.display:${mode}`),
      click: () => actions.setDisplay({ mode }),
    }))

  /**
   * What the viewport does, as opposed to what the scene holds — the 3D counterpart of the
   * canvas rows above, and the reason the 3D bar could go from twenty-three buttons to eight.
   *
   * All seven rows were reachable by pointer through that bar alone. They are settings one
   * changes once a session, not gestures repeated by the minute, which is what a menu is for.
   */
  const sceneViewMenu: MenuItemConstructorOptions[] =
    workspace === '3d'
      ? [
          { type: 'separator' },
          { label: t.menu.sceneDisplay, submenu: displayItems() },
          { label: t.menu.sceneView, submenu: viewItems() },
          { type: 'separator' },
          toggleItem('scene.projection', t.commands.sceneProjection.title),
          toggleItem('scene.quad', t.commands.sceneQuad.title),
          toggleItem('scene.quadEdges', t.commands.sceneQuadEdges.title),
          { type: 'separator' },
          toggleItem('scene.skeletons', t.commands.sceneSkeletons.title),
          toggleItem('scene.poseMode', t.commands.scenePoseMode.title),
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
        {
          label: t.menu.saveDocumentAs,
          accelerator: shortcut('document.saveAs'),
          click: () => actions.runCommand('document.saveAs'),
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
    ...addMenu,
    {
      label: t.menu.view,
      submenu: [
        /**
         * The way in, and the only one: `app.assistant` is a `global` command, and a global
         * command is fired by this menu rather than by the window — nothing in the renderer
         * listens on that scope. Without this row, ⌘K would reach nothing at all.
         *
         * Under View for the reason the whole shell is laid out the way it is: this studio is
         * modelled on VSCode, where the command palette is exactly where a hand goes looking.
         */
        commandItem('app.assistant', t.commands.appAssistant.title),
        { type: 'separator' },
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
        ...sceneViewMenu,
        { type: 'separator' },
        {
          label: t.menu.fullScreen,
          accelerator: shortcut('window.fullScreen'),
          click: () => actions.toggleFullScreen(),
        },
        ...developerItems(isDevelopment, roleItem),
      ],
    },
    {
      role: 'windowMenu',
      label: t.menu.window,
      // Left to the role alone, Electron composes these rows out of English literals. Written
      // out keeps the role — `MenuItem` does `submenu || getDefaultSubmenu(role)` — and the
      // items are the ones it would have built: same roles, same order, same separator.
      submenu: isMac
        ? [roleItem('minimize'), roleItem('zoom'), { type: 'separator' }, roleItem('front')]
        : [roleItem('minimize'), roleItem('zoom'), roleItem('close')],
    },
    ...helpMenu,
  ]
}

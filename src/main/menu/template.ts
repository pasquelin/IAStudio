// `import type`, not `import { type … }`: with verbatimModuleSyntax the latter keeps a runtime
// import of Electron, and this module could no longer be tested under plain Node.
import type { MenuItemConstructorOptions } from 'electron'
import { APP_NAME } from '@shared/constants'
import { CREATABLES } from '@shared/domain/creatable'
import { pathBaseNameOf, stemOf } from '@shared/domain/fileName'
import {
  projectName,
  projectsByCreation,
  type RecentDocument,
  type RecentProject,
} from '@shared/domain/project'
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
  commandDescriptor,
  commandIn,
  type BindingOverrides,
  type CommandId,
  type CommandScope,
  type MenuAbility,
  type MenuCheck,
} from '@shared/domain/command'
import { acceleratorOf, typesText } from '@shared/domain/shortcut'
import { fillHoles, TRANSLATIONS, type Language, type Translations } from '@shared/i18n'
import { MATERIAL_EXPORT_TARGETS } from '@shared/domain/materialExport'
import { FACE_SIZES, SKY_PANORAMAS } from '@shared/domain/skybox'
import type {
  NewDocumentRequest,
  RecentOpenRequest,
  SceneAddRequest,
  SceneCaptureCommand,
  SceneDisplayRequest,
  SceneExportCommand,
  SceneViewRequest,
  SkyboxExportCommand,
  MaterialExportCommand,
  ToolRequest,
} from '@shared/ipc'
import {
  CAPTURE_QUALITIES,
  DEFAULT_CAPTURE_QUALITY,
  type CaptureQuality,
} from '@shared/domain/sceneCapture'

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
  newDocument: (request: NewDocumentRequest) => void
  openRecent: (request: RecentOpenRequest) => void
  addNode: (request: SceneAddRequest) => void
  viewFrom: (request: SceneViewRequest) => void
  setDisplay: (request: SceneDisplayRequest) => void
  exportScene: (command: SceneExportCommand) => void
  captureScene: (command: SceneCaptureCommand) => void
  exportMaterial: (command: MaterialExportCommand) => void
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
  /** Whose history Undo pops, `null` where nothing is undoable — see `setWorkspace` in `shared/ipc.ts`. */
  scope: CommandScope | null
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
  /** The rows the focused window reported as answerable — a row absent from here is drawn greyed. */
  abilities: readonly MenuAbility[]
  /**
   * The folder of the open project, `null` where none is. Read from the main process rather than
   * reported by the window: the main process OWNS the open project, and a fact it holds travelling
   * through a renderer is a fact free to arrive late — File ▸ New file would stay greyed over a
   * project already open.
   *
   * The PATH and not a boolean: a recent document says which project it belongs to, and only
   * where that is not the one in front — two members for one fact would be free to disagree.
   */
  openProject: string | null
  /**
   * What File ▸ Open recent lists. From the main process for the same reason `hasProject` is: it
   * is what holds the settings, and the two lists are written by opening things rather than by
   * any window reporting them.
   */
  recentProjects: readonly RecentProject[]
  recentDocuments: readonly RecentDocument[]
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
  const {
    language,
    workspace,
    scope,
    tools,
    checked,
    abilities,
    isMac,
    isDevelopment,
    openProject,
    recentProjects,
    recentDocuments,
    overrides,
    actions,
  } = options

  // 🛑 Every rank below reads the SCOPE for what edits, never `workspace`: the 3D space also opens
  // interfaces, and a scene row over one acts on a scene nobody is looking at.
  /**
   * How a native row may carry a command's key, read off the registry so the menu never advertises
   * one a remap has moved. `registerAccelerator` is Windows and Linux ONLY: on macOS a row that
   * carries one has it RESERVED, which is how twenty-three rows swallowed `V`, `E` and `[` as typed.
   */
  const keyOf = (
    command: CommandId,
    registerAccelerator = true,
  ): Pick<MenuItemConstructorOptions, 'accelerator' | 'registerAccelerator'> => {
    const binding = bindingOf(command, overrides)
    // `commandFor` excludes `global`, so the menu is that scope's only door: its key stays declared
    // even where a remap has made it one a field would write.
    const typed = typesText(binding) && commandDescriptor(command)?.scope !== 'global'
    return {
      accelerator: typed && isMac ? undefined : acceleratorOf(binding),
      registerAccelerator: registerAccelerator && !typed,
    }
  }

  const t = TRANSLATIONS[language]

  // Interpolated rather than spelled out in both bundles: `constants.test.ts` pins the product
  // name to one place, and a hard-coded copy here would drift past it unnoticed.
  const named = (sentence: string): string => fillHoles(sentence, { name: APP_NAME }, language)
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
    ...keyOf('app.settings'),
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
    MATERIAL_EXPORT_TARGETS.map(target => ({
      label: t.materialExportTargets[target],
      click: () => actions.exportMaterial({ target }),
    }))

  /**
   * One face size per row. A sky has no engine to choose between — six PNGs named `_Rt`…`_Bk` is
   * what all of them read — so what the rows offer is the one thing that does differ.
   */
  const skyboxItems = (): MenuItemConstructorOptions[] => [
    ...FACE_SIZES.map(size => ({
      label: fillHoles(t.skyboxFaceSize, { size }, language),
      click: () => actions.exportSkybox({ kind: 'faces', size }),
    })),
    { type: 'separator' },
    // The one picture the faces are cut out of, at the source's own resolution — which is why
    // these two carry no size to choose. An engine lights a scene from a panorama, not from six.
    ...SKY_PANORAMAS.map(target => ({
      label: t.skyboxPanoramas[target],
      click: () => actions.exportSkybox({ kind: 'panorama', target }),
    })),
  ]

  /**
   * What the space in front can send out, under ONE row. Flat, the montages put three « Exporter
   * … » in a row at the top level of the File menu, which is not what an application looks like.
   *
   * Only where the thing being edited is what the rows export: an image document has neither a
   * scene nor a set of channels, and a row that exported nothing would still look like one.
   *
   * The labels inside are short — « La vidéo… » — because the row above already says Export. The
   * commands keep their full title for the palette, where nothing stands above them.
   */
  const exportSubmenu = (): MenuItemConstructorOptions[] => {
    if (scope === 'scene') {
      return [
        { label: t.menu.exportScene, submenu: exportItems('scene') },
        // Greyed rather than dropped: a row that comes and goes is one the eye has to look for.
        {
          label: t.menu.exportSelection,
          enabled: abilities.includes('scene.exportSelection'),
          submenu: exportItems('selection'),
        },
      ]
    }

    if (workspace === 'materials')
      return [{ label: t.menu.exportMaterial, submenu: textureItems() }]
    if (workspace === 'skyboxes') return [{ label: t.menu.exportSkybox, submenu: skyboxItems() }]

    // A command rather than an action of its own, unlike the three above: what a montage exports
    // is composed by the window — decoders, scenes and all — so the main process asks the
    // surface in front to do it instead of describing what to write.
    if (workspace === 'video') {
      return [
        commandItem('sequence.export', t.menu.exportVideo),
        commandItem('sequence.exportCut', t.menu.exportCut),
        commandItem('sequence.exportBundle', t.menu.exportBundle),
        commandItem('sequence.exportEdl', t.menu.exportEdl),
        commandItem('sequence.exportFcpxml', t.menu.exportFcpxml),
        commandItem('sequence.exportStems', t.menu.exportStems),
      ]
    }

    // The same montage without a picture row — and no film to render out of a document with none.
    if (workspace === 'audio') {
      return [
        commandItem('sequence.exportCut', t.menu.exportCut),
        commandItem('sequence.exportBundle', t.menu.exportBundle),
        commandItem('sequence.exportStems', t.menu.exportStems),
      ]
    }

    // Two rows rather than a submenu of formats: what an image exports is composed by the window,
    // as a montage is, and the flatten already has a binding of its own.
    if (workspace === 'image') {
      return [
        commandItem('canvas.export', t.menu.exportPicture),
        commandItem('canvas.exportLayered', t.menu.exportLayers),
      ]
    }

    // Code and an interface reach this, both by design: a `.ts` and a `.ui.json` ARE already
    // files of the project, so the row is absent rather than empty. An interface opens in the 3D
    // space, hence the `surface` above rather than the workspace — `menu/template.test.ts` holds
    // both halves.
    return []
  }

  /**
   * What the studio can read back. A submenu of ONE today, and it stays a submenu: the row is
   * about to gain a sibling per format, and « Importer… » naming a montage would then have lied.
   */
  const importMenu = (): MenuItemConstructorOptions[] => [
    {
      label: t.menu.import,
      submenu: [commandItem('montage.import', t.menu.importBundle)],
    },
  ]

  /**
   * Nothing at all where the space sends nothing out: an empty « Export » row promises one.
   * No separator of its own — the import above it opens the group, and it is always there.
   */
  const exportMenu = (): MenuItemConstructorOptions[] => {
    const items = exportSubmenu()
    return items.length === 0 ? [] : [{ label: t.menu.export, submenu: items }]
  }

  /**
   * Greyed rather than dropped, as `Export ▸ Selection` above: a row that comes and goes is one
   * the eye has to look for. `undefined` for the rows nothing decides, which is most of them.
   */
  const ableTo = (ability: MenuAbility): boolean => abilities.includes(ability)

  /**
   * A row that is exactly a command: its label, its accelerator and what it fires all come from
   * the registry, so a title translated once is never translated again for the menu.
   */
  const commandItem = (
    command: CommandId,
    label: string,
    registerAccelerator = true,
  ): MenuItemConstructorOptions => ({
    // The command it fires, carried on the row. `can be reached` used to match on the TITLE, so a
    // row worded for its place — « La vidéo… » under Export — read as a command reachable nowhere.
    id: command,
    label,
    ...keyOf(command, registerAccelerator),
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
  const undo = scope && commandIn(scope, 'undo')
  const redo = scope && commandIn(scope, 'redo')

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
    scope === 'scene'
      ? [
          { type: 'separator' },
          commandItem('scene.duplicate', t.commands.sceneDuplicate.title),
          commandItem('scene.group', t.commands.sceneGroup.title),
          // The solids, under the grouping they read like: both fold a selection into one row
          // of the outliner. Their keys are unbound, so the menu is where a hand finds them.
          { type: 'separator' },
          commandItem('scene.negate', t.commands.sceneNegate.title),
          commandItem('scene.carve', t.commands.sceneCarve.title),
          commandItem('scene.weld', t.commands.sceneWeld.title),
          commandItem('scene.intersect', t.commands.sceneIntersect.title),
          commandItem('scene.separate', t.commands.sceneSeparate.title),
          commandItem('scene.invertCarve', t.commands.sceneInvertCarve.title),
          { type: 'separator' },
          // Both, where the context menu shows one at a time: a row is posted before anything is
          // selected, so it cannot know which of the two the hand will want. Each does nothing
          // where it does not apply, which a menu row is allowed to do and a context row is not.
          commandItem('scene.addToSheet', t.commands.sceneAddToSheet.title),
          commandItem('scene.removeFromSheet', t.commands.sceneRemoveFromSheet.title),
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
      // Unreserved like the clipboard above, and for the same reason: reserved, AppKit serves
      // ⌘A to the menu and the window never sees it — on a canvas the native role selects
      // nothing, so the key was dead AND unbindable.
      { ...roleItem('selectAll'), registerAccelerator: false },
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
          commandItem('canvas.grid', t.menu.grid),
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
   * A still of the view, at the definition each row names. Under the view rows rather than
   * beside the exports: what this writes is a picture OF the scene, not the scene itself.
   */
  const captureItems = (): MenuItemConstructorOptions[] =>
    CAPTURE_QUALITIES.map((quality: CaptureQuality) =>
      // The first row IS the command — same picture, same size — so it carries its id and can
      // be remapped to a key. The others name a definition the command cannot say.
      quality === DEFAULT_CAPTURE_QUALITY
        ? commandItem('scene.capture', t.sceneCaptureQualities[quality])
        : {
            label: t.sceneCaptureQualities[quality],
            click: () => actions.captureScene({ quality }),
          },
    )

  /**
   * What the viewport does, as opposed to what the scene holds — the 3D counterpart of the
   * canvas rows above, and the reason the 3D bar could go from twenty-three buttons to eight.
   *
   * All seven rows were reachable by pointer through that bar alone. They are settings one
   * changes once a session, not gestures repeated by the minute, which is what a menu is for.
   */
  const sceneViewMenu: MenuItemConstructorOptions[] =
    scope === 'scene'
      ? [
          { type: 'separator' },
          { label: t.menu.sceneDisplay, submenu: displayItems() },
          { label: t.menu.sceneView, submenu: viewItems() },
          { label: t.menu.sceneCapture, submenu: captureItems() },
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
              {
                ...commandItem('canvas.mergeDown', t.commands.canvasMergeDown.title),
                enabled: ableTo('canvas.mergeDown'),
              },
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
              {
                ...commandItem(
                  'canvas.maskFromSelection',
                  t.commands.canvasMaskFromSelection.title,
                ),
                enabled: ableTo('canvas.maskFromSelection'),
              },
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
   * The shelf, in one submenu: the projects first, by the same creation order every other surface
   * lists them in, then the documents in the order they were last opened — which is what "recent
   * files" means in every application, and what a project must NOT be ordered by, a shelf that
   * reshuffles under the click being a shelf one misses.
   *
   * Absent altogether when there is nothing to list: an empty submenu is a row that looks broken.
   */
  const openRecentMenu = (): MenuItemConstructorOptions[] => {
    const projects = projectsByCreation([...recentProjects]).map(entry => ({
      label: projectName(entry.path),
      click: () => actions.openRecent({ project: entry.path }),
    }))

    const documents = recentDocuments.map(entry => ({
      // The project's name beside the document's, and only where it is not the one in front: a
      // row that performs a project SWITCH has to say so before it is clicked.
      label:
        entry.project === openProject
          ? stemOf(pathBaseNameOf(entry.path))
          : `${stemOf(pathBaseNameOf(entry.path))} — ${projectName(entry.project)}`,
      click: () => actions.openRecent({ project: entry.project, path: entry.path }),
    }))

    if (projects.length === 0 && documents.length === 0) return []

    const between: MenuItemConstructorOptions[] =
      projects.length > 0 && documents.length > 0 ? [{ type: 'separator' }] : []

    return [{ label: t.menu.openRecent, submenu: [...projects, ...between, ...documents] }]
  }

  /** Only where a scene is what is being edited: an Add menu elsewhere would add nothing. */
  const addMenu: MenuItemConstructorOptions[] =
    scope === 'scene'
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
        // The window that offers both, and the one row of this menu that is never greyed: with no
        // project open it is the way to one.
        {
          label: t.menu.newDocument,
          ...keyOf('app.new'),
          click: () => actions.runCommand('app.new'),
        },
        {
          label: t.menu.newProject,
          ...keyOf('project.new'),
          click: () => actions.runCommand('project.new'),
        },
        {
          label: t.menu.newFile,
          // The rail's own order, and never the surface's: a native menu whose rows move under the
          // pointer is a menu one has to read again every time. The WINDOW is where the order
          // follows what one is doing.
          submenu: CREATABLES.map(({ kind }) => ({
            label: t.documents.kinds[kind],
            // A document is a file in a project folder: with none open there is nowhere to write
            // it, and the row would fail after the click rather than before it.
            enabled: openProject !== null,
            click: () => actions.newDocument({ kind }),
          })),
        },
        { type: 'separator' },
        {
          label: t.menu.openProject,
          ...keyOf('project.open'),
          click: () => actions.runCommand('project.open'),
        },
        ...openRecentMenu(),
        { type: 'separator' },
        {
          label: t.menu.saveDocument,
          ...keyOf('document.save'),
          click: () => actions.runCommand('document.save'),
        },
        {
          label: t.menu.saveDocumentAs,
          ...keyOf('document.saveAs'),
          click: () => actions.runCommand('document.saveAs'),
        },
        { type: 'separator' },
        ...importMenu(),
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
        // Through the fabric like every other command row: written by hand, it carried no `id`,
        // and the guard that checks a command can be reached could not see it at all.
        commandItem('layout.reset', t.menu.resetLayout),
        ...canvasViewMenu,
        ...sceneViewMenu,
        { type: 'separator' },
        {
          label: t.menu.fullScreen,
          ...keyOf('window.fullScreen'),
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

import type { MenuItemConstructorOptions } from 'electron'
import { describe, expect, it, vi } from 'vitest'
import { APP_NAME } from '@shared/constants'
import { NO_BREAK_SPACE } from '@shared/i18n/typography'
import { COMMAND_REGISTRY, scopeOfWorkspace } from '@shared/domain/command'
import {
  DISPLAY_MODES,
  EXPORT_FORMATS,
  LIGHT_ENTRIES,
  MESH_ENTRIES,
  VIEW_DIRECTIONS,
} from '@shared/domain/scene'
import { CAPTURE_QUALITIES } from '@shared/domain/sceneCapture'
import { LANGUAGES, TRANSLATIONS } from '@shared/i18n'
import { WORKSPACE_IDS, type WorkspaceId } from '@shared/domain/workspace'
import type { DocumentKind } from '@shared/domain/document'
import type { RecentDocument } from '@shared/domain/project'
import type { NavigationPreset } from '@shared/domain/navigationPreset'
import { menuTemplate, type MenuActions, type MenuOptions } from './template'

const actions = (overrides: Partial<MenuActions> = {}): MenuActions => ({
  setNavigationPreset: () => {},
  openSettings: () => {},
  openLicences: () => {},
  openManual: () => {},
  openUsage: () => {},
  toggleFullScreen: () => {},
  openTool: () => {},
  runCommand: () => {},
  newDocument: () => {},
  openRecent: () => {},
  addNode: () => {},
  setDisplay: () => {},
  exportScene: () => {},
  captureScene: () => {},
  exportMaterial: () => {},
  exportSkybox: () => {},
  ...overrides,
})

/** The scope derived from the space and the kind, as the studio window derives it before announcing. */
const options = ({
  kind = null,
  workspace = '3d',
  ...given
}: Partial<MenuOptions> & { kind?: DocumentKind | null } = {}): MenuOptions => ({
  language: 'fr',
  workspace,
  scope: scopeOfWorkspace(workspace, kind),
  tools: ['meshes', 'lights', 'explorer', 'generator', 'inspector', 'assets'],
  checked: [],
  navigationPreset: 'studio',
  abilities: [],
  isMac: true,
  isDevelopment: true,
  openProject: '/projects/One',
  recentProjects: [],
  recentDocuments: [],
  overrides: {},
  actions: actions(),
  ...given,
})

function submenuOf(
  items: MenuItemConstructorOptions[],
  label: string,
): MenuItemConstructorOptions[] {
  const found = items.find(item => item.label === label)?.submenu
  return Array.isArray(found) ? found : []
}

/** The three arguments Electron hands a click are of no interest to any handler here. */
function activate(item: MenuItemConstructorOptions | undefined): void {
  item?.click?.(...([] as unknown as Parameters<NonNullable<MenuItemConstructorOptions['click']>>))
}

const labels = (template: MenuItemConstructorOptions[]): string[] =>
  template.map(item => (typeof item.label === 'string' ? item.label : ''))

function rolesUnder(template: MenuItemConstructorOptions[], label: string): (string | undefined)[] {
  const menu = template.find(item => item.label === label)
  return Array.isArray(menu?.submenu) ? menu.submenu.map(entry => entry.role) : []
}

describe('the Image menu', () => {
  /**
   * Turning a picture has no conventional shortcut, so the menu is the only way in. A command in
   * the registry that nothing surfaces is a command that cannot be run — the defect the image
   * toolbar has already shown twice.
   */
  it('offers the whole-document operations where a picture is being edited', () => {
    const entries = labels(submenuOf(menuTemplate(options({ workspace: 'image' })), 'Image'))

    expect(entries).toEqual([
      'Fusionner vers le bas',
      'Aplatir l’image',
      '',
      'Miroir horizontal',
      'Miroir vertical',
      '',
      'Rotation horaire',
      'Rotation antihoraire',
      '',
      'Faire un masque de la sélection',
      '',
      'Régénérer la zone',
      'Étendre',
      'Détourer',
      'Agrandir',
      'Vectoriser',
    ])
  })

  /**
   * The five edits had no default shortcut and no menu row: `COMMAND_REGISTRY` declared them,
   * `ImageDocument` ran them, and nothing anywhere could reach them. The menu is the only door,
   * and it stays keyless on purpose — each one spends credit.
   */
  it('offers the edits without binding a key to any of them', () => {
    const entries = submenuOf(menuTemplate(options({ workspace: 'image' })), 'Image')
    const edits = ['Régénérer la zone', 'Étendre', 'Détourer', 'Agrandir', 'Vectoriser']

    const rows = entries.filter(entry => edits.includes(String(entry.label)))
    expect(rows).toHaveLength(edits.length)
    expect(rows.map(row => row.accelerator)).toEqual(edits.map(() => undefined))
  })

  it('fires the edit the row names', () => {
    const runCommand = vi.fn()
    const entries = submenuOf(
      menuTemplate(options({ workspace: 'image', actions: actions({ runCommand }) })),
      'Image',
    )

    activate(entries.find(entry => entry.label === 'Détourer'))

    expect(runCommand).toHaveBeenCalledWith('canvas.cutout')
  })

  it('leaves it out of every other workspace, where it would turn nothing', () => {
    expect(labels(menuTemplate(options({ workspace: '3d' })))).not.toContain('Image')
    expect(labels(menuTemplate(options({ workspace: null })))).not.toContain('Image')
  })

  it('fires the command the row names', () => {
    const runCommand = vi.fn()
    const entries = submenuOf(
      menuTemplate(options({ workspace: 'image', actions: actions({ runCommand }) })),
      'Image',
    )

    activate(entries.find(entry => entry.label === 'Rotation horaire'))

    expect(runCommand).toHaveBeenCalledWith('canvas.rotateCw')
  })
})

/**
 * The rows that took the place of fifteen toolbar buttons. Seven of the nine were reachable by
 * pointer through that bar alone, which is what made shrinking it to eight impossible until now.
 */
describe('the 3D View rows', () => {
  const viewOf = (given: Partial<MenuOptions> = {}): MenuItemConstructorOptions[] =>
    submenuOf(menuTemplate(options(given)), 'Affichage')

  it('are offered in the 3D workspace alone', () => {
    expect(labels(viewOf())).toContain('Mode de rendu')
    expect(labels(viewOf({ workspace: 'image' }))).not.toContain('Mode de rendu')
    expect(labels(viewOf({ workspace: null }))).not.toContain('Mode de rendu')
  })

  it('offers one row per side, and per way of drawing', () => {
    // The six, a separator, and the camera the seventh looks through.
    expect(submenuOf(viewOf(), 'Point de vue')).toHaveLength(VIEW_DIRECTIONS.length + 2)
    expect(submenuOf(viewOf(), 'Mode de rendu')).toHaveLength(DISPLAY_MODES.length)
  })

  /** A command rather than an action of its own: the keypad reaches these too, under Blender. */
  it('fires the command of the side the row names', () => {
    const runCommand = vi.fn()
    const rows = submenuOf(
      submenuOf(menuTemplate(options({ actions: actions({ runCommand }) })), 'Affichage'),
      'Point de vue',
    )

    activate(rows.find(row => row.label === 'De dessus'))
    expect(runCommand).toHaveBeenCalledWith('scene.viewTop')
  })

  it('asks the scene to draw the way the row names', () => {
    const setDisplay = vi.fn()
    const rows = submenuOf(
      submenuOf(menuTemplate(options({ actions: actions({ setDisplay }) })), 'Affichage'),
      'Mode de rendu',
    )

    activate(rows.find(row => row.label === 'Filaire'))
    expect(setDisplay).toHaveBeenCalledWith({ mode: 'wireframe' })
  })

  it('offers one capture row per definition, in the 3D workspace alone', () => {
    expect(submenuOf(viewOf(), 'Capturer la vue')).toHaveLength(CAPTURE_QUALITIES.length)
    expect(labels(viewOf({ workspace: 'video' }))).not.toContain('Capturer la vue')
  })

  it('captures at the definition the row names', () => {
    const captureScene = vi.fn()
    const rows = submenuOf(
      submenuOf(menuTemplate(options({ actions: actions({ captureScene }) })), 'Affichage'),
      'Capturer la vue',
    )

    activate(rows.find(row => row.label === '4K'))
    expect(captureScene).toHaveBeenCalledWith({ quality: 'ultraHd' })
  })

  // The row at the view's own size IS the command, which is what makes the capture remappable —
  // and what stops `can be reached` from calling a keyless command unreachable.
  it('fires the command itself for the row that takes the view as it is', () => {
    const runCommand = vi.fn()
    const rows = submenuOf(
      submenuOf(menuTemplate(options({ actions: actions({ runCommand }) })), 'Affichage'),
      'Capturer la vue',
    )

    activate(rows.find(row => row.label === 'Taille de la vue'))
    expect(runCommand).toHaveBeenCalledWith('scene.capture')
  })

  /**
   * A toggle that reads the same on and off is half a control, and the reason the six of them
   * could not simply be moved: the state belongs to the document, which the main process has no
   * access to. It arrives through `checked`.
   */
  it('ticks exactly the rows the window reported', () => {
    const rows = viewOf({ checked: ['scene.quad', 'scene.skeletons'] })
    const ticked = rows.filter(row => row.checked === true).map(row => row.label)

    expect(ticked).toEqual(['Quatre vues', 'Afficher les squelettes'])
  })

  it('draws its toggles as checkboxes rather than as plain rows', () => {
    const rows = viewOf().filter(row => row.label === 'Mode pose')
    expect(rows[0]?.type).toBe('checkbox')
  })

  /** Exactly one way of drawing is true at a time, which a row of checkboxes would not say. */
  it('draws the ways of drawing as alternatives, and ticks the one in force', () => {
    const rows = submenuOf(viewOf({ checked: ['scene.display:matcap'] }), 'Mode de rendu')

    expect(rows.every(row => row.type === 'radio')).toBe(true)
    expect(rows.filter(row => row.checked === true).map(row => row.label)).toEqual(['Matcap'])
  })

  /** The tick follows the value, not the row: nothing is on in a scene nobody has touched. */
  it('ticks nothing at all when the window reported nothing', () => {
    expect(viewOf().filter(row => row.checked === true)).toEqual([])
  })
})

describe('every command the studio declares', () => {
  /**
   * A command with no default key and no menu row cannot be run at all. Four of them were in
   * that state — the guides, the snapping and the mask from a selection — implemented, tested,
   * and unreachable. The registry is where a command is declared; this is where it earns a way in.
   *
   * Read off the `id` each row carries rather than off its LABEL: a row is worded for where it
   * sits — « Vidéo… » under Export says Export once — and matching on the title made three
   * commands read as unreachable the day the menu gained a submenu.
   */
  it('can be reached, by a key or by a row', () => {
    const fired = new Set<string>()
    const collect = (items: readonly MenuItemConstructorOptions[]): void => {
      for (const item of items) {
        if (item.id) fired.add(String(item.id))
        if (Array.isArray(item.submenu)) collect(item.submenu)
      }
    }

    // Every workspace posts its own rows, so the union is what the studio actually offers.
    const spaces: WorkspaceId[] = ['image', '3d', 'video', 'audio', 'materials', 'skyboxes']
    for (const workspace of spaces) collect(menuTemplate(options({ workspace })))

    const stranded = COMMAND_REGISTRY.filter(
      descriptor => !descriptor.defaultBinding && !fired.has(descriptor.id),
    )

    expect(stranded.map(descriptor => descriptor.id)).toEqual([])
  })
})

describe('the Edit menu', () => {
  /**
   * `role: 'editMenu'` registers ⌘Z with the system: AppKit served the key to the menu and the
   * window never saw it, so `canvas.undo`, `scene.undo` and `sequence.undo` were unreachable by
   * keyboard in all three spaces — an application that appeared to have no undo at all.
   */
  it('binds undo to the surface the workspace edits', () => {
    const cases: [WorkspaceId, string][] = [
      ['image', 'canvas.undo'],
      ['3d', 'scene.undo'],
      ['video', 'sequence.undo'],
      ['skyboxes', 'skybox.undo'],
      // The take editor joined them when its bar was asked to stop drawing the only undo it
      // had: the row below is now the whole of how that history is reached by pointer.
      ['audio', 'audio.undo'],
    ]

    for (const [workspace, expected] of cases) {
      const runCommand = vi.fn()
      const entries = submenuOf(
        menuTemplate(options({ workspace, actions: actions({ runCommand }) })),
        'Édition',
      )

      activate(entries.find(entry => entry.label === 'Annuler'))
      expect(runCommand).toHaveBeenCalledWith(expected)
    }
  })

  /**
   * The three gestures that left the 3D bar. Not the clipboard trio beside them: those keep the
   * native roles so a text field goes on copying, and a command row would act on the scene with
   * the caret in a field — the menu path carries no `isTyping` guard.
   */
  describe('the rows a scene adds', () => {
    const editOf = (workspace: WorkspaceId | null): (string | undefined)[] =>
      submenuOf(menuTemplate(options({ workspace })), 'Édition').map(item => item.label)

    it('offers duplicate, group and delete in the 3D workspace alone', () => {
      expect(editOf('3d')).toEqual(expect.arrayContaining(['Dupliquer', 'Grouper', 'Supprimer']))
      expect(editOf('image')).not.toContain('Grouper')
      expect(editOf(null)).not.toContain('Grouper')
    })

    it('leaves the clipboard to the platform, so a field goes on copying', () => {
      const rows = submenuOf(menuTemplate(options({ workspace: '3d' })), 'Édition')
      const clipboard = rows.filter(row => ['cut', 'copy', 'paste'].includes(row.role ?? ''))

      expect(clipboard).toHaveLength(3)
      expect(clipboard.every(row => row.click === undefined)).toBe(true)
    })

    it('fires the command the row names', () => {
      const runCommand = vi.fn()
      const rows = submenuOf(
        menuTemplate(options({ workspace: '3d', actions: actions({ runCommand }) })),
        'Édition',
      )

      activate(rows.find(row => row.label === 'Grouper'))
      expect(runCommand).toHaveBeenCalledWith('scene.group')
    })

    it('opens whole-world performance from the scene menu', () => {
      const runCommand = vi.fn()
      const rows = submenuOf(
        menuTemplate(options({ workspace: '3d', actions: actions({ runCommand }) })),
        'Édition',
      )

      activate(rows.find(row => row.label === 'Performances du monde…'))

      expect(runCommand).toHaveBeenCalledWith('scene.worldPerformance')
    })
  })

  // The skeleton window: no space, no document, a history all the same.
  it('binds undo to a history the window reports without any space', () => {
    const entries = submenuOf(
      menuTemplate(options({ workspace: null, scope: 'character' })),
      'Édition',
    )

    expect(entries[0]?.id).toBe('character.undo')
    expect(entries[1]?.id).toBe('character.redo')
  })

  /**
   * What the menu does when the focused window names no surface at all — the settings window,
   * the splash: the platform keeps the key rather than a command answering for a history the
   * menu cannot name.
   *
   * `null` and not a workspace, deliberately: every one of the seven now maps to a scope, the
   * last two having been wired the day the toolbars stopped drawing their own undo. A test
   * pinned on a workspace would go stale the moment that stopped being true — which is exactly
   * what happened to this one when it named Textures.
   */
  it('leaves undo to the platform where the window edits nothing', () => {
    const entries = submenuOf(menuTemplate(options({ workspace: null })), 'Édition')

    expect(entries[0]?.role).toBe('undo')
  })

  /**
   * Reserving ⌘Z would take it from a field being typed into: the menu would hear it first and
   * undo a brush stroke instead of the word just mistyped. Unreserved, the window sees the key
   * and `useShortcuts` steps aside whenever the caret sits in a text field.
   */
  it('shows the undo key without reserving it either', () => {
    const entries = submenuOf(menuTemplate(options({ workspace: 'image' })), 'Édition')
    const history = entries.filter(entry => ['Annuler', 'Rétablir'].includes(String(entry.label)))

    expect(history).toHaveLength(2)
    expect(history.map(entry => entry.registerAccelerator)).toEqual([false, false])
    expect(history[0]?.accelerator).toBeTruthy()
  })

  /**
   * The clipboard rows keep their native roles — a text field has to go on copying — but must
   * not reserve the key: `scene.copy` is bound to ⌘C too, and `useShortcuts` is what decides
   * between the two by looking at whether text is highlighted.
   */
  it('shows the clipboard keys without reserving them', () => {
    const entries = submenuOf(menuTemplate(options({ workspace: 'image' })), 'Édition')
    const clipboard = entries.filter(entry => ['cut', 'copy', 'paste'].includes(String(entry.role)))

    expect(clipboard).toHaveLength(3)
    expect(clipboard.map(entry => entry.registerAccelerator)).toEqual([false, false, false])
  })
})

describe('menuTemplate', () => {
  it('names the application menu after the product, not the binary', () => {
    expect(labels(menuTemplate(options()))[0]).toBe('IA Studio')
  })

  it('leaves About to the application menu on macOS, where it belongs', () => {
    const entries = submenuOf(menuTemplate(options()), 'Aide')
    expect(entries.map(entry => entry.role)).not.toContain('about')
  })

  it('adds a Help menu elsewhere, the only place About can be reached', () => {
    expect(labels(menuTemplate(options({ isMac: false })))).toContain('Aide')
  })

  it('drops the developer items once packaged', () => {
    const roles = rolesUnder(menuTemplate(options({ isDevelopment: false })), 'Affichage')
    expect(roles).not.toContain('toggleDevTools')
    expect(roles).not.toContain('reload')
  })

  it('keeps them in development, where they are the only way in', () => {
    expect(rolesUnder(menuTemplate(options()), 'Affichage')).toContain('toggleDevTools')
  })

  it('interpolates the product name rather than spelling it out per language', () => {
    const appMenu = menuTemplate(options())[0]
    const about = Array.isArray(appMenu?.submenu) ? appMenu.submenu[0] : undefined
    expect(about?.label).toBe('À propos d’IA Studio')
    expect(about?.label).not.toContain('{{name}}')
  })

  // The case above pins one sentence; a hole left standing anywhere else reaches the menu bar
  // spelled `{{name}}`, and only reading every label says nobody forgot to fill one.
  it('leaves no hole standing in a label, in either language or any workspace', () => {
    const labelsUnder = (items: MenuItemConstructorOptions[]): string[] =>
      items.flatMap(item => [
        typeof item.label === 'string' ? item.label : '',
        ...(Array.isArray(item.submenu) ? labelsUnder(item.submenu) : []),
      ])

    const holed = LANGUAGES.map(({ code }) => code).flatMap(language =>
      WORKSPACE_IDS.flatMap(workspace =>
        labelsUnder(menuTemplate(options({ language, workspace }))).filter(one =>
          one.includes('{{'),
        ),
      ),
    )

    expect(holed).toEqual([])
  })

  it('lets Electron render the About panel rather than hand-rolling a dialog', () => {
    // Windows does have a native panel, fed by `setAboutPanelOptions` — the role suffices.
    const help = menuTemplate(options({ isMac: false })).find(item => item.label === 'Aide')
    const entries = Array.isArray(help?.submenu) ? help.submenu : []
    expect(entries[0]?.role).toBe('about')
  })

  // Every shipped licence asks for its notice to travel with the binary; Help is where an
  // application keeps it, on all three platforms.
  it('offers the licences under Help, macOS included', () => {
    for (const isMac of [true, false]) {
      expect(labels(submenuOf(menuTemplate(options({ isMac })), 'Aide'))).toContain('Licences')
    }
  })

  // Consumption is read, never edited: it belongs beside About, not among the preferences.
  it('offers the usage window under Help on every platform', () => {
    for (const isMac of [true, false]) {
      expect(labels(submenuOf(menuTemplate(options({ isMac })), 'Aide'))).toContain('Consommation…')
    }
  })

  it('opens the usage window through the main process too', () => {
    const openUsage = vi.fn()
    const entries = submenuOf(menuTemplate(options({ actions: actions({ openUsage }) })), 'Aide')

    activate(entries.find(entry => entry.label === 'Consommation…'))
    expect(openUsage).toHaveBeenCalledOnce()
  })

  it('opens them through the main process, which owns the window', () => {
    const openLicences = vi.fn()
    const entries = submenuOf(menuTemplate(options({ actions: actions({ openLicences }) })), 'Aide')

    activate(entries.find(entry => entry.label === 'Licences'))
    expect(openLicences).toHaveBeenCalledOnce()
  })

  it('lists only the panels the section has', () => {
    const items = submenuOf(submenuOf(menuTemplate(options()), 'Affichage'), 'Modules')
    expect(labels(items)).toContain('Mailles')
    expect(labels(items)).not.toContain('Calques')
  })

  // The renderer is the only side that knows whether a model was chosen, and generating
  // without one is impossible: a menu entry offering it would open an empty panel.
  it('leaves out a panel the renderer did not report', () => {
    const tools = options().tools.filter(id => id !== 'generator')
    const items = submenuOf(submenuOf(menuTemplate(options({ tools })), 'Affichage'), 'Modules')
    expect(labels(items)).not.toContain('Génération')
  })

  it('offers no panel to a window that announced no workspace', () => {
    const view = submenuOf(menuTemplate(options({ workspace: null })), 'Affichage')
    expect(submenuOf(view, 'Modules')).toHaveLength(0)
  })

  it('offers Add only in the 3D workspace', () => {
    expect(labels(menuTemplate(options({ workspace: 'image' })))).not.toContain('Ajouter')
    expect(labels(menuTemplate(options()))).toContain('Ajouter')
  })

  // The settings window and the splash edit no workspace: neither is offered a scene menu.
  it('offers no Add to a window that announced no workspace', () => {
    expect(labels(menuTemplate(options({ workspace: null })))).not.toContain('Ajouter')
  })

  it('covers every primitive and every light', () => {
    const add = submenuOf(menuTemplate(options()), 'Ajouter')

    expect(submenuOf(add, 'Maille')).toHaveLength(MESH_ENTRIES.length)
    expect(submenuOf(add, 'Lumière')).toHaveLength(LIGHT_ENTRIES.length)
  })

  it('offers every object, each of them reachable', () => {
    const objects = submenuOf(submenuOf(menuTemplate(options()), 'Ajouter'), 'Objet')

    expect(objects.map(item => item.label)).toEqual([
      'Sprite',
      'Texte',
      'Caméra',
      'Chemin',
      'Joueur',
    ])
    expect(objects.filter(item => item.enabled === false)).toEqual([])
  })

  // Every mesh the table declares is buildable: what is not lives under Object.
  it('greys out no mesh at all', () => {
    const meshes = submenuOf(submenuOf(menuTemplate(options()), 'Ajouter'), 'Maille')

    expect(meshes.filter(item => item.enabled === false)).toEqual([])
  })

  it('asks for the node by kind, so the payload cannot drift from the entry', () => {
    const addNode = vi.fn()
    const template = menuTemplate(options({ actions: actions({ addNode }) }))

    activate(submenuOf(submenuOf(template, 'Ajouter'), 'Maille')[0])

    expect(addNode).toHaveBeenCalledWith({ kind: 'box' })
  })

  it('keeps Add between Edit and View, where every editor puts it', () => {
    const names = labels(menuTemplate(options()))

    expect(names.indexOf('Ajouter')).toBeGreaterThan(names.indexOf('Édition'))
    expect(names.indexOf('Ajouter')).toBeLessThan(names.indexOf('Affichage'))
  })

  it('names every panel it lists — an unnamed entry is a way back nobody finds', () => {
    const tools = submenuOf(submenuOf(menuTemplate(options()), 'Affichage'), 'Modules')

    expect(tools).toHaveLength(options().tools.length)
    for (const item of tools) expect(item.label).toBeTruthy()
  })
})

describe('File ▸ New file', () => {
  const newFileItems = (given: Partial<MenuOptions> = {}) =>
    submenuOf(submenuOf(menuTemplate(options(given)), 'Fichier'), 'Nouveau fichier')

  /**
   * Every kind, from every space. `gui` is the one this row exists for: it was reachable from
   * nowhere at all, the New button reading only the head of its space's kinds.
   */
  it('offers every kind of document, in the order of the rail', () => {
    expect(newFileItems().map(item => item.label)).toEqual([
      'Image',
      'Vidéo',
      'Scène',
      'Interface',
      'Script',
      'Audio',
      'Matière',
      'Ciel',
    ])
  })

  it('asks the window for the kind of the row that was picked', () => {
    const asked: DocumentKind[] = []
    const items = submenuOf(
      submenuOf(
        menuTemplate(
          options({ actions: actions({ newDocument: ({ kind }) => asked.push(kind) }) }),
        ),
        'Fichier',
      ),
      'Nouveau fichier',
    )

    items
      .find(item => item.label === 'Interface')
      ?.click?.(null as never, undefined as never, null as never)

    expect(asked).toEqual(['gui'])
  })

  /**
   * A document is a file in a project folder: with none open the row would fail after the click
   * rather than before it. Greyed and not dropped — a menu that changes length is a menu one has
   * to read again.
   */
  it('greys every kind with no project open, and keeps them all', () => {
    const items = newFileItems({ openProject: null })

    expect(items).toHaveLength(8)
    expect(items.every(item => item.enabled === false)).toBe(true)
  })
})

/**
 * Both refuse in silence over a screen with no document — `routeCommand` answers `noSurface` and
 * nothing on the menu said so, which is what an enabled row promises it will not do.
 */
describe('the two Save rows', () => {
  const saveRows = (given: Partial<MenuOptions> = {}) =>
    submenuOf(menuTemplate(options(given)), 'Fichier').filter(item =>
      ['Enregistrer', 'Enregistrer sous…'].includes(item.label ?? ''),
    )

  it('answer with a document in front', () => {
    const rows = saveRows({ abilities: ['document.save', 'document.saveAs'] })

    expect(rows.map(row => row.enabled)).toEqual([true, true])
  })

  it('are greyed with none', () => {
    expect(saveRows().map(row => row.enabled)).toEqual([false, false])
  })
})

describe('File ▸ Open recent', () => {
  const PROJECTS = [
    { path: '/projects/One', openedAt: '2026-09-01T10:00:00.000Z', createdAt: '2026-08-01' },
    { path: '/projects/Two', openedAt: '2026-09-02T10:00:00.000Z', createdAt: '2026-08-02' },
  ]

  const DOCUMENTS: RecentDocument[] = [
    {
      project: '/projects/One',
      path: 'Modelling/Scenes/Niveau.gltf',
      kind: 'scene',
      openedAt: '2026-09-02T11:00:00.000Z',
    },
    {
      project: '/projects/Two',
      path: 'Images/Planche.ora',
      kind: 'image',
      openedAt: '2026-09-02T10:00:00.000Z',
    },
  ]

  const recentItems = (given: Partial<MenuOptions> = {}) =>
    submenuOf(submenuOf(menuTemplate(options(given)), 'Fichier'), 'Ouvrir récent')

  it('lists the projects newest first, then the documents last opened first', () => {
    const items = recentItems({ recentProjects: PROJECTS, recentDocuments: DOCUMENTS })

    expect(items.map(item => item.label ?? item.type)).toEqual([
      'Two',
      'One',
      'separator',
      'Niveau',
      'Planche — Two',
    ])
  })

  /** A row that performs a project SWITCH has to say so before it is clicked. */
  it('names the project only where it is not the one in front', () => {
    const items = recentItems({
      openProject: '/projects/Two',
      recentProjects: [],
      recentDocuments: DOCUMENTS,
    })

    expect(items.map(item => item.label)).toEqual(['Niveau — One', 'Planche'])
  })

  it('asks for the project alone on a project row, and for both on a document', () => {
    const asked: unknown[] = []
    const items = submenuOf(
      submenuOf(
        menuTemplate(
          options({
            recentProjects: PROJECTS,
            recentDocuments: DOCUMENTS,
            actions: actions({ openRecent: request => asked.push(request) }),
          }),
        ),
        'Fichier',
      ),
      'Ouvrir récent',
    )

    const fire = (label: string) =>
      items
        .find(item => item.label === label)
        ?.click?.(null as never, undefined as never, null as never)

    fire('Two')
    fire('Planche — Two')

    expect(asked).toEqual([
      { project: '/projects/Two' },
      { project: '/projects/Two', path: 'Images/Planche.ora' },
    ])
  })

  /** An empty submenu is a row that looks broken — a first launch has nothing to list. */
  it('is not there at all with nothing to list', () => {
    const file = submenuOf(menuTemplate(options()), 'Fichier')

    expect(file.find(item => item.label === 'Ouvrir récent')).toBeUndefined()
  })
})

describe('the accelerators the menu advertises', () => {
  const fileItems = (given: Partial<MenuOptions> = {}) =>
    submenuOf(menuTemplate(options(given)), 'Fichier')

  it('reads them off the command registry rather than spelling them out', () => {
    const item = fileItems().find(entry => entry.label === 'Nouveau projet…')

    // ⌥⌘N since 2026-09-02: ⌘N makes a FILE here as it does everywhere else, and ⇧⌘N is the
    // Explorer's New folder.
    expect(item?.accelerator).toBe('Alt+CmdOrCtrl+N')
  })

  it('gives ⌘N to the window that makes a file, as every other application does', () => {
    const item = fileItems().find(entry => entry.label === 'Nouveau…')

    expect(item?.accelerator).toBe('CmdOrCtrl+N')
  })

  // The bug this replaces: the menu wrote its own accelerators, so it kept advertising a key
  // the command no longer answered to — and the remap reached the window but never the menu.
  it('follows a remap', () => {
    const item = fileItems({ overrides: { 'project.new': 'Shift+Meta+KeyN' } }).find(
      entry => entry.label === 'Nouveau projet…',
    )

    expect(item?.accelerator).toBe('Shift+CmdOrCtrl+N')
  })

  it('leaves a command bound to nothing without one, rather than an empty string', () => {
    const view = submenuOf(menuTemplate(options()), 'Affichage')
    const item = view.find(entry => entry.label === 'Réinitialiser la disposition')

    expect(item?.accelerator).toBeUndefined()
  })

  it('fires the command the registry names, not a verb of its own', () => {
    const fired: string[] = []
    const item = submenuOf(
      menuTemplate(
        options({ actions: actions({ runCommand: command => void fired.push(command) }) }),
      ),
      'Fichier',
    ).find(entry => entry.label === 'Nouveau projet…')

    item?.click?.(
      // The three arguments Electron hands a click handler, none of which this one reads.
      ...([{}, undefined, {}] as Parameters<NonNullable<MenuItemConstructorOptions['click']>>),
    )

    expect(fired).toEqual(['project.new'])
  })
})

/**
 * `role: 'reload'` carries ⌘R implicitly, and ⌘R is the rulers of the image workspace. Two items
 * of one submenu claiming a single key is served by whichever AppKit finds first.
 */
describe('accelerators within the View menu', () => {
  it('never lets two items claim the same key', () => {
    const items = submenuOf(menuTemplate(options()), 'Affichage')
    const keys = items.flatMap(item =>
      item.accelerator ? [item.accelerator] : item.role === 'reload' ? ['CmdOrCtrl+R'] : [],
    )

    expect(new Set(keys).size).toBe(keys.length)
  })

  it('keeps the developer reload reachable, one modifier further', () => {
    const items = submenuOf(menuTemplate(options()), 'Affichage')
    expect(items.find(item => item.role === 'reload')?.accelerator).toBe('Shift+CmdOrCtrl+R')
  })
})

/** Fichier ▸ Exporter, which is where every space now puts what it sends out. */
const exportsIn = (menu: ReturnType<typeof menuTemplate>) =>
  submenuOf(submenuOf(menu, 'Fichier'), 'Exporter')

describe('the export menu', () => {
  /**
   * One row rather than several at the top of the File menu. Flat, the two montage spaces put
   * three « Exporter … » in a row beside Save — which is not what an application looks like.
   */
  it('puts everything a space sends out under one row', () => {
    const file = submenuOf(menuTemplate(options({ workspace: 'video' })), 'Fichier')

    expect(file.map(item => item.label)).toContain('Exporter')
    expect(file.map(item => item.label)).not.toContain('Vidéo…')
    expect(
      exportsIn(menuTemplate(options({ workspace: 'video' }))).map(item => item.label),
    ).toEqual([
      'Vidéo…',
      'Montage (OTIO)…',
      'Montage et médias (OTIOZ)…',
      'Liste de montage (EDL)…',
      'Montage (FCPXML)…',
      'Sons par piste (WAV)…',
    ])
  })

  /** Every space that MAKES something sends it out; Code does not, and the row is absent rather
   * than empty. Both halves asserted, so a Code export would be named here. */
  it('shows the row in every space that makes a file of its own, and in no other', () => {
    for (const workspace of WORKSPACE_IDS) {
      const file = submenuOf(menuTemplate(options({ workspace })), 'Fichier').map(one => one.label)

      expect(file.includes('Exporter'), workspace).toBe(workspace !== 'code')
    }
  })

  /**
   * 🛑 The 3D space opens two KINDS, and the row follows the kind rather than the space: a
   * `.ui.json` is already a file of the project, like a script, so there is nothing to export.
   */
  it('drops the row for an interface, which the 3D space opens beside its scenes', () => {
    const file = (kind: DocumentKind) =>
      submenuOf(menuTemplate(options({ workspace: '3d', kind })), 'Fichier').map(one => one.label)

    expect(file('scene')).toContain('Exporter')
    expect(file('gui')).not.toContain('Exporter')
  })

  it('offers every declared format, for the scene and for the selection', () => {
    const exports = exportsIn(menuTemplate(options()))

    expect(submenuOf(exports, 'Scène').map(item => item.label)).toEqual([
      'glTF binaire (.glb)',
      'glTF (.gltf)',
      'USDZ (.usdz)',
      'Wavefront, formes seules (.obj)',
      'Stanford, formes seules (.ply)',
      'STL, triangles seuls (.stl)',
    ])
    // The same list on both, and derived from the same one: a format offered for the scene and
    // not for the selection would be a row that appears and disappears with a click.
    expect(submenuOf(exports, 'Sélection')).toHaveLength(EXPORT_FORMATS.length)
  })

  it('asks for the format and the scope the row names', () => {
    const exportScene = vi.fn()
    const exports = exportsIn(menuTemplate(options({ actions: actions({ exportScene }) })))
    const usdz = submenuOf(exports, 'Sélection')[2]

    usdz?.click?.(...([] as never[] as [never, never, never]))

    expect(exportScene).toHaveBeenCalledWith({ format: 'usdz', scope: 'selection' })
  })

  it('greys the selection row where the window reports nothing picked', () => {
    const without = exportsIn(menuTemplate(options()))
    const holding = exportsIn(menuTemplate(options({ abilities: ['scene.exportSelection'] })))

    expect(without.find(item => item.label === 'Sélection')?.enabled).toBe(false)
    expect(holding.find(item => item.label === 'Sélection')?.enabled).toBe(true)
    // The scene itself is never greyed by it: an empty scene is still a scene to write out.
    expect(without.find(item => item.label === 'Scène')?.enabled).toBeUndefined()
  })

  it('offers the five targets where a texture is what is being edited', () => {
    const exports = exportsIn(menuTemplate(options({ workspace: 'materials' })))

    expect(submenuOf(exports, 'Matière').map(item => item.label)).toEqual([
      'glTF / GLB (.glb)',
      'Unity (URP)',
      'Unreal Engine',
      'Roblox',
      'Canaux bruts',
    ])
  })

  it('asks for the engine the row names', () => {
    const exportMaterial = vi.fn()
    const exports = exportsIn(
      menuTemplate(options({ workspace: 'materials', actions: actions({ exportMaterial }) })),
    )
    const roblox = submenuOf(exports, 'Matière')[3]

    roblox?.click?.(...([] as never[] as [never, never, never]))

    expect(exportMaterial).toHaveBeenCalledWith({ target: 'roblox' })
  })

  it('shows each workspace only the export that belongs to it', () => {
    const labels = (workspace: WorkspaceId): (string | undefined)[] =>
      exportsIn(menuTemplate(options({ workspace }))).map(item => item.label)

    expect(labels('3d')).toContain('Scène')
    expect(labels('3d')).not.toContain('Matière')
    expect(labels('materials')).toContain('Matière')
    expect(labels('materials')).not.toContain('Scène')
    expect(labels('skyboxes')).toContain('Ciel')
    expect(labels('skyboxes')).not.toContain('Matière')
    // Two rows rather than a submenu of formats, as the montage has: what an image writes is
    // composed by the window, and the flatten already answers a binding of its own.
    expect(labels('image')).toEqual(['Image aplatie (PNG)…', 'Image à calques (PSD)…'])
  })
})

describe('exporting a sky', () => {
  it('offers one row per face size, then the panoramas, and nothing else', () => {
    const exports = exportsIn(menuTemplate(options({ workspace: 'skyboxes' })))

    // Written through the constant, which is why it exists: the no-break space binding a size to
    // its `×` is invisible here, and a literal one would have been read as an ordinary space.
    const size = (side: number): string => `${side}${NO_BREAK_SPACE}×${NO_BREAK_SPACE}${side}`

    // The separator carries no label: what a row says is the assertion, and a separator says
    // nothing on purpose.
    expect(submenuOf(exports, 'Ciel').map(item => item.label)).toEqual([
      size(512),
      size(1024),
      size(2048),
      undefined,
      'Panorama Radiance (.hdr)',
      'Panorama OpenEXR (.exr)',
    ])
  })

  /** A panorama leaves at the source's own resolution: a size chosen for it would be a lie. */
  it('asks for a panorama by its target rather than by a size', () => {
    const exportSkybox = vi.fn()
    const exports = exportsIn(
      menuTemplate(options({ workspace: 'skyboxes', actions: actions({ exportSkybox }) })),
    )

    submenuOf(exports, 'Ciel')
      .find(item => item.label === 'Panorama OpenEXR (.exr)')
      ?.click?.(...([] as never[] as [never, never, never]))

    expect(exportSkybox).toHaveBeenCalledWith({ kind: 'panorama', target: 'sky.exr' })
  })

  it('asks for the size the row names', () => {
    const exportSkybox = vi.fn()
    const exports = exportsIn(
      menuTemplate(options({ workspace: 'skyboxes', actions: actions({ exportSkybox }) })),
    )
    const largest = submenuOf(exports, 'Ciel')[2]

    largest?.click?.(...([] as never[] as [never, never, never]))

    expect(exportSkybox).toHaveBeenCalledWith({ kind: 'faces', size: 2048 })
  })
})

/**
 * A role draws its own label, and Electron writes those labels as English literals in
 * `roleList` — "Cut", "Select All", `Hide ${app.name}`. No locale is consulted: an unlabelled
 * role reads English on every platform, whatever the system or the studio is set to.
 *
 * Walked rather than listed: a sixteenth role added without a label would pass a list.
 */
describe('every native role', () => {
  const rolesWithout = (
    items: MenuItemConstructorOptions[],
    sound: (item: MenuItemConstructorOptions) => boolean,
  ): string[] =>
    items.flatMap(item => [
      ...(item.role && !sound(item) ? [item.role] : []),
      ...(Array.isArray(item.submenu) ? rolesWithout(item.submenu, sound) : []),
    ])

  /**
   * Four shapes, because three branches only exist in some of them: `nativeHistory` is reached
   * only by a window that edits no workspace — Settings, the splash — and `close` becomes `quit`
   * off macOS. A single shape walked a menu that had neither, and passed while both shipped bare.
   */
  const SHAPES: Partial<MenuOptions>[] = [
    { workspace: '3d', isMac: true },
    { workspace: null, isMac: true },
    { workspace: '3d', isMac: false },
    { workspace: null, isMac: false },
  ]

  it('carries a label of ours, in every language and every shape of the menu', () => {
    for (const { code } of LANGUAGES) {
      for (const shape of SHAPES) {
        const template = menuTemplate(options({ ...shape, language: code }))

        expect(
          rolesWithout(template, item => typeof item.label === 'string'),
          `${code}, workspace ${shape.workspace}, mac ${shape.isMac}`,
        ).toEqual([])
      }
    }
  })

  /**
   * The walk above cannot reach the rows of a submenu the template never wrote: these six roles
   * compose one themselves, out of the same English literals, when none is given. Only
   * `windowMenu` is reached for today — the other five are held for the day one is.
   *
   * Typed rather than left as strings: a misspelt role would match nothing and pass silently.
   */
  const CONTAINER_ROLES: NonNullable<MenuItemConstructorOptions['role']>[] = [
    'appMenu',
    'fileMenu',
    'editMenu',
    'viewMenu',
    'windowMenu',
    'shareMenu',
  ]

  it('leaves no submenu for Electron to compose', () => {
    for (const shape of SHAPES) {
      expect(
        rolesWithout(
          menuTemplate(options(shape)),
          item => !item.role || !CONTAINER_ROLES.includes(item.role) || item.submenu !== undefined,
        ),
        `workspace ${shape.workspace}, mac ${shape.isMac}`,
      ).toEqual([])
    }
  })

  // The rows Electron would have composed, in our words: same roles, same order, same separator.
  it('names the window rows itself, on both platforms', () => {
    const rows = (isMac: boolean): MenuItemConstructorOptions[] =>
      submenuOf(menuTemplate(options({ isMac })), TRANSLATIONS.fr.menu.window)
    const shapeOf = (items: MenuItemConstructorOptions[]): (string | undefined)[] =>
      items.map(item => item.role ?? item.type)

    expect(shapeOf(rows(true))).toEqual(['minimize', 'zoom', 'separator', 'front'])
    expect(labels(rows(true))).toEqual(['Réduire', 'Zoom', '', 'Tout ramener au premier plan'])
    expect(shapeOf(rows(false))).toEqual(['minimize', 'zoom', 'close'])
    expect(labels(rows(false))).toEqual(['Réduire', 'Zoom', 'Fermer la fenêtre'])
  })

  // A label read off the wrong bundle is worse than none: it would look deliberate.
  it('reads its label from the language it was asked for', () => {
    const french = menuTemplate(options({ language: 'fr' }))
    const english = menuTemplate(options({ language: 'en' }))
    const cutIn = (template: MenuItemConstructorOptions[]): string | undefined =>
      submenuOf(template, TRANSLATIONS.fr.menu.edit)
        .concat(submenuOf(template, TRANSLATIONS.en.menu.edit))
        .find(item => item.role === 'cut')?.label

    expect(cutIn(french)).toBe('Couper')
    expect(cutIn(english)).toBe('Cut')
  })

  // The product name is pinned in one place; a bundle spelling it out would drift past it.
  it('names the product in the entries that mention it', () => {
    const app = submenuOf(menuTemplate(options()), APP_NAME)

    expect(app.find(item => item.role === 'quit')?.label).toBe(`Quitter ${APP_NAME}`)
    expect(app.find(item => item.role === 'hide')?.label).toBe(`Masquer ${APP_NAME}`)
  })
})

/**
 * The home covers a workspace rather than replacing it, so the renderer used to publish the
 * space behind it: the studio offered the twenty-two image tools and the whole Image menu over
 * a screen that edits no picture, and every one of them fired into nothing.
 *
 * Named as a surface for that reason — `home` is not a workspace, so each section that belongs
 * to a document drops on its own, with no list of exceptions to keep in step.
 */
describe('the home', () => {
  const home = (): MenuItemConstructorOptions[] => menuTemplate(options({ workspace: 'home' }))

  it('offers neither the image tools nor the Image menu', () => {
    expect(labels(home())).not.toContain('Outils')
    expect(labels(home())).not.toContain('Image')
  })

  it('offers no section that only a document can answer', () => {
    const sections = labels(home())

    expect(sections).not.toContain('Graphe')
    expect(sections).not.toContain('Ajouter')
    expect(submenuOf(home(), 'Fichier').map(entry => entry.label)).not.toContain(
      'Exporter la scène',
    )
  })

  /**
   * Undo belongs to the surface being edited, and the home edits none. The rows keep their
   * NATIVE roles there — the platform's own undo is the only one there is — where a workspace
   * turns them into command rows that hand ⌘Z to the document in front.
   */
  it('leaves undo to the platform', () => {
    const rows = submenuOf(home(), 'Édition').filter(entry =>
      ['Annuler', 'Rétablir'].includes(String(entry.label)),
    )

    expect(rows.map(entry => entry.role)).toEqual(['undo', 'redo'])
    expect(rows.map(entry => entry.click)).toEqual([undefined, undefined])
  })

  /**
   * The gain, and the reason the surface is published rather than `null`: the home carries
   * panels of its own, and a window announcing no surface at all is offered none.
   */
  it('still offers the panels the home itself carries', () => {
    const reported = menuTemplate(options({ workspace: 'home', tools: ['projects', 'meshes'] }))
    const panels = submenuOf(submenuOf(reported, 'Affichage'), 'Modules')

    expect(labels(panels)).toEqual(['Vos projets'])
  })
})

/**
 * The keys a caret has a use for — bare letters, `[`, `Delete`, anything Shift or Alt reaches. On
 * macOS a declared accelerator is reserved with the system whatever `registerAccelerator` says,
 * and typing a layer name armed a tool, letter by letter.
 *
 * A `global` command is the exception, and the case below says why: no window listens for that
 * scope, so the menu is its only door and its key stays declared.
 */
describe('the keys the menu leaves to a field', () => {
  const rowsOf = (items: MenuItemConstructorOptions[]): MenuItemConstructorOptions[] =>
    items.flatMap(item => [item, ...(Array.isArray(item.submenu) ? rowsOf(item.submenu) : [])])

  const everyRow = (given: Partial<MenuOptions> = {}): MenuItemConstructorOptions[] =>
    [...WORKSPACE_IDS, null].flatMap(workspace =>
      rowsOf(menuTemplate(options({ ...given, workspace }))),
    )

  const typedRows = (rows: MenuItemConstructorOptions[]): MenuItemConstructorOptions[] =>
    rows.filter(row => row.accelerator !== undefined && !/Cmd|Ctrl/.test(String(row.accelerator)))

  const macRows = everyRow()

  it('declares none of them on macOS, where the system would take the key', () => {
    const declared = typedRows(macRows).map(
      row => `${String(row.label)} — ${String(row.accelerator)}`,
    )

    expect(declared).toEqual([])
  })

  it('shows them elsewhere without reserving them', () => {
    const shown = typedRows(everyRow({ isMac: false }))

    expect(shown.length).toBeGreaterThan(0)
    expect(shown.filter(row => row.registerAccelerator !== false)).toEqual([])
  })

  /** A remap is what the registry never saw coming — and Alt writes a character on a Mac. */
  it('answers to the binding in force, not to the default', () => {
    const overrides = { 'scene.duplicate': 'Alt+KeyK' }
    // Off macOS the row still SHOWS the remapped key, which is what proves it reached it.
    const shown = typedRows(everyRow({ overrides, isMac: false })).map(row => row.accelerator)

    expect(shown).toContain('Alt+K')
    expect(typedRows(everyRow({ overrides }))).toEqual([])
  })

  /**
   * The one scope no window hears — `commandFor` excludes it. Dropping the key would leave the
   * row as the only way in and no key at all, where the studio would rather keep both.
   */
  it('leaves a global command its key, the menu being its only door', () => {
    const remapped = everyRow({ overrides: { 'document.save': 'KeyS' } })

    expect(typedRows(remapped).map(row => row.accelerator)).toContain('S')
  })

  it('keeps the chords a field would never write', () => {
    expect(macRows.find(row => row.id === 'scene.group')?.accelerator).toBe('CmdOrCtrl+G')
  })
})

/**
 * The 3D space opens a scene AND the interfaces shown over it. What the Edit menu offers has to
 * follow the tab in front: Group, Carve or Weld over an interface act on a scene nobody is
 * looking at, and Undo has to pop the history the tab actually holds.
 */
describe('the edit menu of a space that opens two kinds', () => {
  const editRows = (kind: DocumentKind): string =>
    labels(submenuOf(menuTemplate(options({ workspace: '3d', kind })), 'Édition')).join(' ')

  it('offers what acts on a scene over a scene, and none of it over an interface', () => {
    expect(editRows('scene')).toContain('Grouper')
    expect(editRows('gui')).not.toContain('Grouper')
  })

  /** Both keep an Undo — what changes is WHOSE history it pops, which the scope decides. */
  it('keeps an undo over either kind', () => {
    expect(editRows('scene')).toContain('Annuler')
    expect(editRows('gui')).toContain('Annuler')
  })
})

describe('the navigation schemes', () => {
  const rows = (preset: NavigationPreset) =>
    submenuOf(
      submenuOf(menuTemplate(options({ scope: 'scene', navigationPreset: preset })), 'Affichage'),
      'Navigation',
    )

  it('offers the four applications, the studio and one of one’s own, exactly one ticked', () => {
    const shown = rows('blender')

    expect(shown.map(row => row.label)).toEqual([
      'IA Studio',
      'Unreal Engine',
      'Unity',
      'Blender',
      'Roblox Studio',
      'Personnalisé',
    ])
    // `radio` and not a row of checkboxes: one is true at a time, and AppKit draws the mark.
    expect(shown.every(row => row.type === 'radio')).toBe(true)
    expect(shown.filter(row => row.checked).map(row => row.label)).toEqual(['Blender'])
  })

  it('writes the one that was picked, and nothing else', () => {
    const picked: string[] = []
    const template = menuTemplate(
      options({
        scope: 'scene',
        actions: actions({ setNavigationPreset: preset => picked.push(preset) }),
      }),
    )

    activate(submenuOf(submenuOf(template, 'Affichage'), 'Navigation')[3])

    expect(picked).toEqual(['blender'])
  })

  /** A menu of the image space has no 3D view to drive, so it must not offer one. */
  it('says nothing of navigation outside a scene', () => {
    const shown = submenuOf(menuTemplate(options({ workspace: 'image' })), 'Affichage')
    expect(shown.map(row => row.label)).not.toContain('Navigation')
  })
})

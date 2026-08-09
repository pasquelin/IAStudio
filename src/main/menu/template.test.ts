import type { MenuItemConstructorOptions } from 'electron'
import { describe, expect, it, vi } from 'vitest'
import { COMMAND_REGISTRY } from '@shared/domain/command'
import { LIGHT_ENTRIES, MESH_ENTRIES } from '@shared/domain/scene'
import { TRANSLATIONS } from '@shared/i18n'
import type { WorkspaceId } from '@shared/domain/workspace'
import { menuTemplate, type MenuActions, type MenuOptions } from './template'

const actions = (overrides: Partial<MenuActions> = {}): MenuActions => ({
  openSettings: () => {},
  openLicences: () => {},
  openUsage: () => {},
  toggleFullScreen: () => {},
  openTool: () => {},
  runCommand: () => {},
  addNode: () => {},
  exportScene: () => {},
  exportTexture: () => {},
  exportSkybox: () => {},
  ...overrides,
})

const options = (given: Partial<MenuOptions> = {}): MenuOptions => ({
  language: 'fr',
  workspace: '3d',
  tools: ['meshes', 'lights', 'explorer', 'models', 'generator', 'inspector', 'assets'],
  isMac: true,
  isDevelopment: true,
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

describe('every command the studio declares', () => {
  /**
   * A command with no default key and no menu row cannot be run at all. Four of them were in
   * that state — the guides, the snapping and the mask from a selection — implemented, tested,
   * and unreachable. The registry is where a command is declared; this is where it earns a way in.
   */
  it('can be reached, by a key or by a row', () => {
    const rows = new Set<string>()
    const collect = (items: readonly MenuItemConstructorOptions[]): void => {
      for (const item of items) {
        if (item.label) rows.add(String(item.label))
        if (Array.isArray(item.submenu)) collect(item.submenu)
      }
    }

    // Every workspace posts its own rows, so the union is what the studio actually offers.
    const spaces: WorkspaceId[] = ['image', '3d', 'video', 'audio', 'textures', 'skyboxes']
    for (const workspace of spaces) collect(menuTemplate(options({ workspace })))

    const titles = TRANSLATIONS.fr.commands
    const stranded = COMMAND_REGISTRY.filter(descriptor => {
      if (descriptor.defaultBinding) return false
      const key = descriptor.titleKey.replace('commands.', '').replace('.title', '')
      const label = titles[key as keyof typeof titles]?.title
      return !label || !rows.has(label)
    })

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

  // Nothing is undoable there, so the platform keeps the key rather than a command answering
  // for a history that does not exist.
  it('leaves undo to the platform where nothing is undoable', () => {
    const entries = submenuOf(menuTemplate(options({ workspace: 'audio' })), 'Édition')

    expect(entries[0]?.role).toBe('undo')
  })

  /**
   * The clipboard rows keep their native roles — a text field has to go on copying — but must
   * not reserve the key: `scene.copy` is bound to ⌘C too, and `useShortcuts` is what decides
   * between the two by looking at whether text is highlighted.
   */
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

  it('shows the clipboard keys without reserving them', () => {
    const entries = submenuOf(menuTemplate(options({ workspace: 'image' })), 'Édition')
    const clipboard = entries.filter(entry => ['cut', 'copy', 'paste'].includes(String(entry.role)))

    expect(clipboard).toHaveLength(3)
    expect(clipboard.map(entry => entry.registerAccelerator)).toEqual([false, false, false])
  })
})

describe('menuTemplate', () => {
  it('names the application menu after the product, not the binary', () => {
    expect(labels(menuTemplate(options()))[0]).toBe('Scenario Studio')
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
    expect(about?.label).toBe('À propos de Scenario Studio')
    expect(about?.label).not.toContain('{{name}}')
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

  it('offers both objects, both of them reachable', () => {
    const objects = submenuOf(submenuOf(menuTemplate(options()), 'Ajouter'), 'Objet')

    expect(objects.map(item => item.label)).toEqual(['Sprite', 'Texte'])
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

describe('the accelerators the menu advertises', () => {
  const fileItems = (given: Partial<MenuOptions> = {}) =>
    submenuOf(menuTemplate(options(given)), 'Fichier')

  it('reads them off the command registry rather than spelling them out', () => {
    const item = fileItems().find(entry => entry.label === 'Nouveau projet…')

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

describe('the export menu', () => {
  it('offers the three formats, for the scene and for the selection', () => {
    const file = submenuOf(menuTemplate(options()), 'Fichier')

    expect(submenuOf(file, 'Exporter la scène').map(item => item.label)).toEqual([
      'glTF binaire (.glb)',
      'glTF (.gltf)',
      'USDZ (.usdz)',
    ])
    expect(submenuOf(file, 'Exporter la sélection')).toHaveLength(3)
  })

  it('asks for the format and the scope the row names', () => {
    const exportScene = vi.fn()
    const file = submenuOf(menuTemplate(options({ actions: actions({ exportScene }) })), 'Fichier')
    const usdz = submenuOf(file, 'Exporter la sélection')[2]

    usdz?.click?.(...([] as never[] as [never, never, never]))

    expect(exportScene).toHaveBeenCalledWith({ format: 'usdz', scope: 'selection' })
  })

  it('offers the five targets where a texture is what is being edited', () => {
    const file = submenuOf(menuTemplate(options({ workspace: 'textures' })), 'Fichier')

    expect(submenuOf(file, 'Exporter la matière').map(item => item.label)).toEqual([
      'glTF / GLB (.glb)',
      'Unity (URP)',
      'Unreal Engine',
      'Roblox',
      'Canaux bruts',
    ])
  })

  it('asks for the engine the row names', () => {
    const exportTexture = vi.fn()
    const file = submenuOf(
      menuTemplate(options({ workspace: 'textures', actions: actions({ exportTexture }) })),
      'Fichier',
    )
    const roblox = submenuOf(file, 'Exporter la matière')[3]

    roblox?.click?.(...([] as never[] as [never, never, never]))

    expect(exportTexture).toHaveBeenCalledWith({ target: 'roblox' })
  })

  // Exporting an image document is another errand, with another writer behind it.
  it('shows each workspace only the export that belongs to it', () => {
    const labels = (workspace: WorkspaceId): (string | undefined)[] =>
      submenuOf(menuTemplate(options({ workspace })), 'Fichier').map(item => item.label)

    expect(labels('3d')).toContain('Exporter la scène')
    expect(labels('3d')).not.toContain('Exporter la matière')
    expect(labels('textures')).toContain('Exporter la matière')
    expect(labels('textures')).not.toContain('Exporter la scène')
    expect(labels('skyboxes')).toContain('Exporter le ciel')
    expect(labels('skyboxes')).not.toContain('Exporter la matière')
    expect(labels('image')).not.toContain('Exporter la scène')
    expect(labels('image')).not.toContain('Exporter la matière')
    expect(labels('image')).not.toContain('Exporter le ciel')
  })
})

describe('exporting a sky', () => {
  it('offers one row per face size, and only sizes the domain knows', () => {
    const file = submenuOf(menuTemplate(options({ workspace: 'skyboxes' })), 'Fichier')

    expect(submenuOf(file, 'Exporter le ciel').map(item => item.label)).toEqual([
      '512 × 512',
      '1024 × 1024',
      '2048 × 2048',
    ])
  })

  it('asks for the size the row names', () => {
    const exportSkybox = vi.fn()
    const file = submenuOf(
      menuTemplate(options({ workspace: 'skyboxes', actions: actions({ exportSkybox }) })),
      'Fichier',
    )
    const largest = submenuOf(file, 'Exporter le ciel')[2]

    largest?.click?.(...([] as never[] as [never, never, never]))

    expect(exportSkybox).toHaveBeenCalledWith({ size: 2048 })
  })
})

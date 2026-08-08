import type { MenuItemConstructorOptions } from 'electron'
import { describe, expect, it, vi } from 'vitest'
import { LIGHT_ENTRIES, MESH_ENTRIES } from '@shared/domain/scene'
import { menuTemplate, type MenuActions, type MenuOptions } from './template'

const actions = (overrides: Partial<MenuActions> = {}): MenuActions => ({
  openSettings: () => {},
  openLicences: () => {},
  toggleFullScreen: () => {},
  openTool: () => {},
  runCommand: () => {},
  addNode: () => {},
  exportScene: () => {},
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

  it('greys out the announced objects instead of hiding them', () => {
    const objects = submenuOf(submenuOf(menuTemplate(options()), 'Ajouter'), 'Objet')

    expect(objects.map(item => item.label)).toEqual(['Sprite', 'Texte'])
    expect(objects.filter(item => item.enabled === false).map(item => item.label)).toEqual([
      'Texte',
    ])
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

  // Exporting an image document is another errand, with another writer behind it.
  it('offers no export outside the 3D workspace', () => {
    const file = submenuOf(menuTemplate(options({ workspace: 'image' })), 'Fichier')

    expect(file.map(item => item.label)).not.toContain('Exporter la scène')
  })
})

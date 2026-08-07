import type { MenuItemConstructorOptions } from 'electron'
import { describe, expect, it, vi } from 'vitest'
import { LIGHT_ENTRIES, MESH_ENTRIES } from '@shared/domain/scene'
import type { WorkspaceId } from '@shared/domain/workspace'
import { menuTemplate, type MenuActions, type MenuContext } from './template'

function actions(overrides: Partial<MenuActions> = {}): MenuActions {
  return {
    openSettings: () => {},
    toggleFullScreen: () => {},
    openTool: () => {},
    runCommand: () => {},
    addNode: () => {},
    ...overrides,
  }
}

function template(
  workspace: WorkspaceId | null,
  overrides: Partial<MenuContext> = {},
): MenuItemConstructorOptions[] {
  return menuTemplate({
    language: 'fr',
    workspace,
    isMac: true,
    appName: 'Scenario Studio',
    developerTools: false,
    actions: actions(),
    ...overrides,
  })
}

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

describe('menuTemplate', () => {
  it('offers Add only in the 3D workspace', () => {
    expect(template('image').map(item => item.label)).not.toContain('Ajouter')
    expect(template('3d').map(item => item.label)).toContain('Ajouter')
  })

  // The settings window edits no workspace: it must not be offered what a scene can do.
  it('offers Add to a window that announced no workspace', () => {
    expect(template(null).map(item => item.label)).not.toContain('Ajouter')
  })

  it('covers every primitive and every light', () => {
    const add = submenuOf(template('3d'), 'Ajouter')

    expect(submenuOf(add, 'Maille')).toHaveLength(MESH_ENTRIES.length)
    expect(submenuOf(add, 'Lumière')).toHaveLength(LIGHT_ENTRIES.length)
  })

  it('greys out the announced primitives instead of hiding them', () => {
    const meshes = submenuOf(submenuOf(template('3d'), 'Ajouter'), 'Maille')

    expect(meshes.filter(item => item.enabled === false).map(item => item.label)).toEqual([
      'Sprite',
      'Texte',
    ])
  })

  it('asks for the node by kind, so the payload cannot drift from the entry', () => {
    const addNode = vi.fn()
    const meshes = submenuOf(
      submenuOf(template('3d', { actions: actions({ addNode }) }), 'Ajouter'),
      'Maille',
    )

    activate(meshes[0])

    expect(addNode).toHaveBeenCalledWith({ kind: 'box' })
  })

  it('keeps Add between Edit and View, where every editor puts it', () => {
    const labels = template('3d').map(item => item.label)

    expect(labels.indexOf('Ajouter')).toBeGreaterThan(labels.indexOf('Édition'))
    expect(labels.indexOf('Ajouter')).toBeLessThan(labels.indexOf('Affichage'))
  })

  // The renderer console reaches `window.studio`: DevTools in a packaged build is a self-XSS
  // away from `setCredentials`.
  it('hides the developer entries unless they were asked for', () => {
    expect(
      submenuOf(template('3d'), 'Affichage').some(item => item.role === 'toggleDevTools'),
    ).toBe(false)

    const withTools = submenuOf(template('3d', { developerTools: true }), 'Affichage')
    expect(withTools.some(item => item.role === 'toggleDevTools')).toBe(true)
  })

  // Outside macOS there is no application menu to hold it.
  it('moves Settings under File off macOS', () => {
    const file = submenuOf(template('3d', { isMac: false }), 'Fichier')

    expect(file.some(item => item.label === 'Réglages…')).toBe(true)
  })

  it('names every tool window it can reopen', () => {
    const tools = submenuOf(submenuOf(template('3d'), 'Affichage'), 'Modules')

    expect(tools.map(item => item.label)).toContain('Mailles')
    expect(tools.map(item => item.label)).toContain('Lumières')
  })
})

import type { MenuItemConstructorOptions } from 'electron'
import { describe, expect, it, vi } from 'vitest'
import { LIGHT_ENTRIES, MESH_ENTRIES } from '@shared/domain/scene'
import type { WorkspaceId } from '@shared/domain/workspace'
import { EVENTS } from '@shared/ipc'
import { menuTemplate, type MenuActions } from './template'

function actions(overrides: Partial<MenuActions> = {}): MenuActions {
  return {
    appName: 'Scenario Studio',
    openSettings: () => {},
    toggleFullScreen: () => {},
    send: () => {},
    developerTools: false,
    ...overrides,
  }
}

function template(workspace: WorkspaceId, given = actions()): MenuItemConstructorOptions[] {
  return menuTemplate('fr', workspace, true, given)
}

function submenuOf(
  items: MenuItemConstructorOptions[],
  label: string,
): MenuItemConstructorOptions[] {
  const found = items.find(item => item.label === label)?.submenu
  return Array.isArray(found) ? found : []
}

describe('menuTemplate', () => {
  it('offers Add only in the 3D workspace', () => {
    expect(template('image').map(item => item.label)).not.toContain('Ajouter')
    expect(template('3d').map(item => item.label)).toContain('Ajouter')
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

  it('asks the focused window for the node, rather than broadcasting it', () => {
    const send = vi.fn()
    const meshes = submenuOf(submenuOf(template('3d', actions({ send })), 'Ajouter'), 'Maille')

    meshes[0]?.click?.(
      // The three arguments Electron hands a click are of no interest to the handler.
      ...([] as unknown as Parameters<NonNullable<MenuItemConstructorOptions['click']>>),
    )

    expect(send).toHaveBeenCalledWith(EVENTS.sceneAdd, { kind: 'box' })
  })

  it('keeps Add between Edit and View, where every editor puts it', () => {
    const labels = template('3d').map(item => item.label)

    expect(labels.indexOf('Ajouter')).toBeGreaterThan(labels.indexOf('Édition'))
    expect(labels.indexOf('Ajouter')).toBeLessThan(labels.indexOf('Affichage'))
  })

  // The renderer console reaches `window.studio`: DevTools in a packaged build is a self-XSS
  // away from `setCredentials`.
  it('hides the developer entries unless they were asked for', () => {
    const view = submenuOf(template('3d'), 'Affichage')
    expect(view.some(item => item.role === 'toggleDevTools')).toBe(false)

    const withTools = submenuOf(
      menuTemplate('fr', '3d', true, actions({ developerTools: true })),
      'Affichage',
    )
    expect(withTools.some(item => item.role === 'toggleDevTools')).toBe(true)
  })

  // Outside macOS there is no application menu to hold it.
  it('moves Settings under File off macOS', () => {
    const file = submenuOf(menuTemplate('fr', '3d', false, actions()), 'Fichier')
    expect(file.some(item => item.label === 'Réglages…')).toBe(true)
  })
})

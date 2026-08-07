import type { MenuItemConstructorOptions } from 'electron'
import { describe, expect, it } from 'vitest'
import { menuTemplate, type MenuOptions } from './template'

const options = (overrides: Partial<MenuOptions> = {}): MenuOptions => ({
  language: 'fr',
  isMac: true,
  isPackaged: false,
  actions: {
    send: () => {},
    openSettings: () => {},
    toggleFullScreen: () => {},
    showAbout: () => {},
  },
  ...overrides,
})

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

  it('has no Help menu on macOS, where About lives in the application menu', () => {
    expect(labels(menuTemplate(options()))).not.toContain('Aide')
  })

  it('adds a Help menu elsewhere, the only place About can be reached', () => {
    expect(labels(menuTemplate(options({ isMac: false })))).toContain('Aide')
  })

  it('drops the developer items once packaged', () => {
    const roles = rolesUnder(menuTemplate(options({ isPackaged: true })), 'Affichage')
    expect(roles).not.toContain('toggleDevTools')
    expect(roles).not.toContain('reload')
  })

  it('keeps them in development, where they are the only way in', () => {
    expect(rolesUnder(menuTemplate(options()), 'Affichage')).toContain('toggleDevTools')
  })
})

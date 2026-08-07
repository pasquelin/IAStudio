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
})

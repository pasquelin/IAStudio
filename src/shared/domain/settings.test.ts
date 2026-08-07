import { describe, expect, it } from 'vitest'
import {
  isSettingsRoute,
  isSettingsSection,
  sectionFromRoute,
  settingsRoute,
  SETTINGS_SECTION_IDS,
} from './settings'

describe('settings sections', () => {
  it('recognises every section it publishes', () => {
    expect(SETTINGS_SECTION_IDS.every(isSettingsSection)).toBe(true)
  })

  it('rejects anything else', () => {
    expect(isSettingsSection('storage')).toBe(false)
    expect(isSettingsSection(undefined)).toBe(false)
  })
})

describe('settings route', () => {
  it('names the window on its own', () => {
    expect(settingsRoute()).toBe('settings')
    expect(isSettingsRoute('#settings')).toBe(true)
  })

  it('carries a section to land on', () => {
    expect(settingsRoute('account')).toBe('settings/account')
  })

  // The two ends of one contract: the main process writes the fragment, the renderer reads it.
  it('reads back what it wrote', () => {
    expect(sectionFromRoute(`#${settingsRoute('media')}`)).toBe('media')
  })

  it('still routes to the settings window when no section is named', () => {
    expect(isSettingsRoute('#settings')).toBe(true)
    expect(sectionFromRoute('#settings')).toBeNull()
  })

  it('keeps the studio out of the settings window', () => {
    expect(isSettingsRoute('')).toBe(false)
    expect(isSettingsRoute('#settingsomething')).toBe(false)
  })

  it('ignores a section it does not know rather than showing nothing', () => {
    expect(sectionFromRoute('#settings/elsewhere')).toBeNull()
  })
})

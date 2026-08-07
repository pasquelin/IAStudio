import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS_SECTION, SETTINGS_SECTION_IDS } from '@shared/domain/settings'
import { findSection, SETTINGS_SECTIONS } from './sections'

describe('settings sections', () => {
  /**
   * The type only stops an id invented here. It says nothing about the other direction, where
   * a name added to the union with no section behind it opens the window on an empty pane.
   */
  it('has a section behind every name a panel may ask for', () => {
    expect(SETTINGS_SECTION_IDS.every(id => findSection(id) !== null)).toBe(true)
  })

  it('opens by default on a section it actually has', () => {
    expect(findSection(DEFAULT_SETTINGS_SECTION)).not.toBeNull()
    expect(SETTINGS_SECTIONS[0]?.id).toBe(DEFAULT_SETTINGS_SECTION)
  })
})

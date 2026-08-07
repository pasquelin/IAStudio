import i18next from 'i18next'
import { describe, expect, it } from 'vitest'
import { COMMAND_IDS } from '@shared/domain/shortcut'
import { SCENE_TOOLS } from './scene-tools'

describe('scene tools', () => {
  it('binds every tool to a known command', () => {
    for (const tool of SCENE_TOOLS) expect(COMMAND_IDS).toContain(tool.command)
  })

  it('names every tool through i18n rather than a literal', () => {
    for (const tool of SCENE_TOOLS) expect(tool.labelKey).toMatch(/^sceneTools\./)
  })

  it('gives every tool an icon', () => {
    for (const tool of SCENE_TOOLS) expect(tool.icon).toBeTruthy()
  })

  it('explains every tool, so no tooltip merely repeats the button’s own name', () => {
    for (const tool of SCENE_TOOLS) expect(tool.descriptionKey).toMatch(/^sceneTools\..+Hint$/)
  })

  it('has a translation behind every key it declares', () => {
    // A key with no string behind it renders as the key itself: the bar would tip `sceneTools.x`.
    for (const tool of SCENE_TOOLS) {
      expect(i18next.exists(tool.labelKey)).toBe(true)
      expect(i18next.exists(tool.descriptionKey ?? '')).toBe(true)
    }
  })
})

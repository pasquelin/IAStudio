import { describe, expect, it } from 'vitest'
import { COMMAND_IDS } from '@shared/domain/shortcut'
import { SCENE_TOOLS, shortcutLabel } from './scene-tools'

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
})

describe('shortcutLabel', () => {
  it('shows the printed letter of a physical key', () => {
    expect(shortcutLabel('KeyG')).toBe('G')
  })

  it('keeps the modifiers in front', () => {
    expect(shortcutLabel('Shift+KeyG')).toBe('⇧G')
  })

  it('leaves a non-letter code readable', () => {
    expect(shortcutLabel('Delete')).toBe('Delete')
  })
})

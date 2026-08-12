import i18next from 'i18next'
import { describe, expect, it } from 'vitest'
import { COMMAND_REGISTRY } from '@shared/domain/command'
import { DISPLAY_MODES } from '@shared/domain/scene'
import { SCENE_TOOLS } from './scene-tools'

const display = SCENE_TOOLS.find(tool => tool.id === 'display')

describe('scene tools', () => {
  it('binds every command it declares to a known one', () => {
    for (const tool of SCENE_TOOLS) {
      expect(COMMAND_REGISTRY.map(descriptor => descriptor.id)).toContain(tool.command)
    }
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

  // A key with no string behind it renders as the key itself: the bar would tip `sceneTools.x`.
  it('has a translation behind every key it declares, flyout rows included', () => {
    for (const tool of SCENE_TOOLS) {
      expect(i18next.exists(tool.labelKey)).toBe(true)
      expect(i18next.exists(tool.descriptionKey ?? '')).toBe(true)
      for (const mode of tool.modes ?? []) expect(i18next.exists(mode.labelKey)).toBe(true)
    }
  })

  // A missing string renders as `sceneViews.top` in the flyout, and nothing else would catch it.
  it('has a translation behind every row label', () => {
    for (const tool of SCENE_TOOLS) {
      for (const mode of tool.modes ?? []) expect(i18next.exists(mode.labelKey)).toBe(true)
    }
  })

  it('gives every flyout row an icon', () => {
    for (const mode of display?.modes ?? []) expect(mode.icon).toBeTruthy()
  })
})

describe('SCENE_TOOLS', () => {
  /**
   * Eight, down from twenty-three. The fifteen that left are all in the native menu now, and
   * this is the number the whole batch is about: a bar of twenty-three icons made the eight
   * that matter impossible to find.
   */
  it('holds what a hand reaches for while manipulating, and nothing else', () => {
    expect(SCENE_TOOLS.map(tool => tool.id)).toEqual([
      'select',
      'translate',
      'rotate',
      'scale',
      'snap',
      'space',
      'display',
      'frame',
    ])
  })

  it('offers every way of drawing under the one flyout it kept', () => {
    expect(display?.modes).toHaveLength(DISPLAY_MODES.length)
  })

  it('keeps the three transform modes as three reachable buttons', () => {
    const ids = SCENE_TOOLS.map(tool => tool.id)

    expect(ids).toContain('translate')
    expect(ids).toContain('rotate')
    expect(ids).toContain('scale')
  })

  // Switched several times a minute: a flyout would cost a hover before every change.
  it('gives none of the three transform buttons a flyout', () => {
    const transforms = SCENE_TOOLS.filter(tool =>
      ['translate', 'rotate', 'scale'].includes(tool.id),
    )

    expect(transforms.every(tool => tool.modes === undefined)).toBe(true)
  })

  it('arms selection first, so a click never grabs a handle by surprise', () => {
    expect(SCENE_TOOLS[0]?.id).toBe('select')
  })

  it('reads as groups rather than a run of icons', () => {
    expect(SCENE_TOOLS.filter(tool => tool.separatorBefore).map(tool => tool.id)).toEqual([
      'snap',
      'display',
      'frame',
    ])
  })

  /**
   * Copy, cut and paste stay on the bar while duplicate, group and delete left for the Edit
   * menu, and the asymmetry is deliberate: those three rows keep their NATIVE roles so a text
   * field goes on copying, and a command row in their place would act on the scene with the
   * caret in a field — the menu path carries no `isTyping` guard.
   */
  it('keeps the clipboard gestures, which no menu row can answer for', () => {
    const ids = SCENE_TOOLS.map(tool => tool.id)

    expect(ids).not.toContain('duplicate')
    expect(ids).not.toContain('group')
    expect(ids).not.toContain('delete')
  })

  // They qualify the armed tool rather than replacing it, so they follow it in their own group.
  it('puts the two toggles next to the transform modes they qualify', () => {
    const ids = SCENE_TOOLS.map(tool => tool.id)

    expect(ids.indexOf('snap')).toBe(ids.indexOf('scale') + 1)
    expect(ids.indexOf('space')).toBe(ids.indexOf('snap') + 1)
  })

  /**
   * Every button carries a command now — the two that acted through their rows alone, Add and
   * the six sides, are menu rows. Display keeps its flyout AND its command: the click cycles
   * what it draws rather than sitting dead under an open flyout.
   */
  it('gives every button a command of its own', () => {
    expect(SCENE_TOOLS.filter(tool => tool.command === undefined)).toEqual([])
  })
})

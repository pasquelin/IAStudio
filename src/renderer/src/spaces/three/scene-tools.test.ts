import i18next from 'i18next'
import { describe, expect, it } from 'vitest'
import { COMMAND_REGISTRY } from '@shared/domain/command'
import { OBJECT_ENTRIES } from '@shared/domain/scene'
import { LIGHT_TYPES } from '@/engines/scene/light-types'
import { MESH_PRIMITIVES } from '@/engines/scene/mesh-primitives'
import { SCENE_TOOLS } from './scene-tools'

const add = SCENE_TOOLS.find(tool => tool.id === 'add')

describe('scene tools', () => {
  it('binds every command it declares to a known one', () => {
    for (const tool of SCENE_TOOLS) {
      if (tool.command)
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

  it('gives every flyout row an icon', () => {
    for (const mode of add?.modes ?? []) expect(mode.icon).toBeTruthy()
  })
})

describe('SCENE_TOOLS', () => {
  it('offers every primitive, every light and every object under one Add button', () => {
    expect(add?.modes).toHaveLength(
      MESH_PRIMITIVES.length + LIGHT_TYPES.length + OBJECT_ENTRIES.length,
    )
  })

  it('keeps the greyed kinds greyed', () => {
    expect(add?.modes?.filter(mode => mode.disabled).map(mode => mode.id)).toEqual(['text'])
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
      'frame',
      'add',
      'duplicate',
    ])
  })

  // Copy and Paste answer to the same keys as the native Edit menu, which acts on text: a
  // button of the scene's own is the only thing that says the scene has them too.
  it('offers the clipboard gestures as buttons, not to the keyboard alone', () => {
    const ids = SCENE_TOOLS.map(tool => tool.id)

    expect(ids).toEqual(expect.arrayContaining(['duplicate', 'copy', 'cut', 'paste']))
  })

  // They qualify the armed tool rather than replacing it, so they follow it in their own group.
  it('puts the two toggles next to the transform modes they qualify', () => {
    const ids = SCENE_TOOLS.map(tool => tool.id)

    expect(ids.indexOf('snap')).toBe(ids.indexOf('scale') + 1)
    expect(ids.indexOf('space')).toBe(ids.indexOf('snap') + 1)
  })

  // A group that only offers modes acts through its rows, never on its own click.
  it('gives every button but Add a command', () => {
    const commandless = SCENE_TOOLS.filter(tool => tool.command === undefined)

    expect(commandless.map(tool => tool.id)).toEqual(['add'])
  })
})

import i18next from 'i18next'
import { describe, expect, it } from 'vitest'
import { IMAGE_TOOLS, toolById } from './image-tools'

describe('image tools', () => {
  it('names every tool through i18n rather than a literal', () => {
    for (const tool of IMAGE_TOOLS) expect(tool.labelKey).toMatch(/^imageTools\./)
  })

  it('gives every tool an icon', () => {
    for (const tool of IMAGE_TOOLS) expect(tool.icon).toBeTruthy()
  })

  it('gives the eraser two modes, so it opens a flyout', () => {
    expect(toolById('eraser')?.modes).toHaveLength(2)
  })

  it('leaves a single-purpose tool without modes, so its button acts directly', () => {
    // Against a group that really exists: `brush` became a mode of `paint`, and asserting on
    // an id that no longer resolves passes while testing nothing.
    expect(toolById('fill')?.modes).toBeUndefined()
    expect(toolById('picker')?.modes).toBeUndefined()
  })

  it('names every mode through i18n too', () => {
    for (const tool of IMAGE_TOOLS) {
      for (const mode of tool.modes ?? []) expect(mode.labelKey).toMatch(/^imageTools\./)
    }
  })

  it('explains every tool, so no tooltip merely repeats the button’s own name', () => {
    for (const tool of IMAGE_TOOLS) expect(tool.descriptionKey).toMatch(/^imageTools\..+Hint$/)
  })

  it('explains every mode too', () => {
    for (const tool of IMAGE_TOOLS) {
      for (const mode of tool.modes ?? []) {
        expect(mode.descriptionKey).toMatch(/^imageTools\..+Hint$/)
      }
    }
  })

  it('has a translation behind every key it declares', () => {
    // A key with no string behind it renders as the key itself: the bar would tip `imageTools.x`.
    for (const tool of IMAGE_TOOLS) {
      expect(i18next.exists(tool.labelKey)).toBe(true)
      expect(i18next.exists(tool.descriptionKey ?? '')).toBe(true)

      for (const mode of tool.modes ?? []) {
        expect(i18next.exists(mode.labelKey)).toBe(true)
        expect(i18next.exists(mode.descriptionKey ?? '')).toBe(true)
      }
    }
  })

  it('finds nothing for an unknown id', () => {
    expect(toolById('nope')).toBeNull()
  })
})

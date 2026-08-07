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

  it('leaves the brush without modes, so its button acts directly', () => {
    expect(toolById('brush')?.modes).toBeUndefined()
  })

  it('names every mode through i18n too', () => {
    for (const tool of IMAGE_TOOLS) {
      for (const mode of tool.modes ?? []) expect(mode.labelKey).toMatch(/^imageTools\./)
    }
  })

  it('finds nothing for an unknown id', () => {
    expect(toolById('nope')).toBeNull()
  })
})

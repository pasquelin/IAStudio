import i18next from 'i18next'
import { describe, expect, it } from 'vitest'
import { DEFAULT_VIDEO_TOOL, isVideoTool, VIDEO_TOOLS } from './videoTools'

describe('video tools', () => {
  it('names every tool through i18n rather than a literal', () => {
    for (const tool of VIDEO_TOOLS) expect(tool.labelKey).toMatch(/^videoTools\./)
  })

  it('gives every tool an icon', () => {
    for (const tool of VIDEO_TOOLS) expect(tool.icon).toBeTruthy()
  })

  it('explains every tool, so no tooltip merely repeats the button’s own name', () => {
    for (const tool of VIDEO_TOOLS) expect(tool.descriptionKey).toMatch(/^videoTools\..+Hint$/)
  })

  it('has a translation behind every key it declares', () => {
    // A key with no string behind it renders as the key itself: the bar would tip `videoTools.x`.
    for (const tool of VIDEO_TOOLS) {
      expect(i18next.exists(tool.labelKey)).toBe(true)
      expect(i18next.exists(tool.descriptionKey ?? '')).toBe(true)
    }
  })

  it('gives every tool a distinct id, which is what the bar keys its buttons on', () => {
    const ids = VIDEO_TOOLS.map(tool => tool.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('opens on a tool that is actually in the bar', () => {
    expect(VIDEO_TOOLS.map(tool => tool.id)).toContain(DEFAULT_VIDEO_TOOL)
  })

  it('recognises its own ids and rejects anything else', () => {
    for (const tool of VIDEO_TOOLS) expect(isVideoTool(tool.id)).toBe(true)
    // The bar hands back a plain string, and another workspace's tool must not slip through.
    expect(isVideoTool('translate')).toBe(false)
  })
})

import i18next from 'i18next'
import { describe, expect, it } from 'vitest'
import { UNBUILT_TOOLS } from '@/engines/canvas/CanvasEngine'
import type { CanvasTool } from '@/engines/canvas/canvasTool'
import { IMAGE_TOOLS, canvasToolFor, toolById } from './image-tools'

/**
 * Every gesture the bar can arm, and whether it is reachable — the group's own button, plus one
 * row per mode. Read through `canvasToolFor`, which is what the component calls: a group whose
 * modes mean different tools is only crossed correctly through it.
 */
const armableRows = (): { id: string; tool: CanvasTool | null; reachable: boolean }[] =>
  IMAGE_TOOLS.flatMap(entry => [
    { id: entry.id, tool: canvasToolFor(entry.id), reachable: entry.disabled !== true },
    ...(entry.modes ?? []).map(mode => ({
      id: `${entry.id}/${mode.id}`,
      tool: canvasToolFor(entry.id, mode.id),
      reachable: entry.disabled !== true && mode.disabled !== true,
    })),
  ])

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

  /**
   * The bar and the engine hold two halves of the same truth, and nothing made them agree: the
   * frame group armed a tool `onPointerDown` ignores, then the comment button did the same. The
   * cursor changed, the button lit, and the pointer did nothing.
   */
  it('greys every row that would arm a tool the engine ignores', () => {
    const live = armableRows().filter(
      row => row.reachable && row.tool && UNBUILT_TOOLS.has(row.tool),
    )
    expect(live.map(row => row.id)).toEqual([])
  })

  it('greys nothing whose tool the engine implements', () => {
    // Groups only: a mode can be greyed for its own sake — `text/path` writes on a curve, which
    // is unbuilt without `text` being, and the two share one `CanvasTool`.
    const hidden = IMAGE_TOOLS.filter(entry => entry.disabled === true).filter(entry => {
      const tool = canvasToolFor(entry.id)
      return !tool || !UNBUILT_TOOLS.has(tool)
    })
    expect(hidden.map(entry => entry.id)).toEqual([])
  })

  /**
   * `MenuButton` hangs the hover wrapper on a div around the button, so a greyed group still
   * opens its menu: a live row inside one is a reachable way to arm what the group refuses.
   */
  it('leaves no live row inside a greyed group, which the flyout would still offer', () => {
    for (const entry of IMAGE_TOOLS) {
      if (entry.disabled !== true) continue
      for (const mode of entry.modes ?? []) expect(mode.disabled).toBe(true)
    }
  })
})

/**
 * The modes of a group do not always mean one tool. Two of them do not, and both were a defect
 * before they were a case: the pointer group holds dragging the content and dragging the view,
 * and the paint group holds a brush and a pencil that lay the same disc with a different edge.
 */
describe('the mode a group is armed on', () => {
  it('tells the pencil from the brush, which the engine reads as two tools', () => {
    expect(canvasToolFor('paint', 'brush')).toBe('brush')
    expect(canvasToolFor('paint', 'pencil')).toBe('pencil')
  })

  it('falls back to the brush for the group with no mode named', () => {
    expect(canvasToolFor('paint')).toBe('brush')
  })

  it('tells dragging the view from dragging the content', () => {
    expect(canvasToolFor('pointer', 'hand')).toBe('hand')
    expect(canvasToolFor('pointer', 'move')).toBe('move')
  })
})

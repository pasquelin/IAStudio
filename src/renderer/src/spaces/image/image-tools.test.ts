import i18next from 'i18next'
import { describe, expect, it } from 'vitest'
import { UNBUILT_TOOLS, type CanvasTool } from '@/engines/canvas/CanvasEngine'
import { isRecord } from '@shared/guards'
import { TRANSLATIONS } from '@shared/i18n'
import {
  IMAGE_TOOLS,
  TOOL_COMMANDS,
  canvasToolFor,
  toolById,
  type ToolCommand,
} from './image-tools'

/** Widened, not cast: the bundle's inferred type carries no index signature. */
const read = (bundle: unknown, key: string): unknown =>
  key
    .split('.')
    .reduce<unknown>((current, part) => (isRecord(current) ? current[part] : undefined), bundle)

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
 * A tool wears two names: the bar shows it in context and names it bare — `Pinceau` — while the
 * shortcuts screen lists it among hundreds of unrelated rows and prefixes it — `Outil Pinceau`.
 * That gap is deliberate, so the two labels are not asked to be equal.
 *
 * Where ENGLISH gives a tool one label on both surfaces, though, the gap was never intended, and
 * French must not invent one. It had: the bar read `Sélection rectangle` where the shortcuts
 * screen read `Sélection rectangulaire` — the same tool, looked up under two names.
 */
describe('the labels a tool wears on both surfaces', () => {
  const labelKeyOf = ({ tool, mode }: ToolCommand): string | undefined => {
    const entry = IMAGE_TOOLS.find(candidate => candidate.id === tool)
    return mode ? entry?.modes?.find(candidate => candidate.id === mode)?.labelKey : entry?.labelKey
  }

  const titleKeyOf = (command: string): string =>
    `commands.${command.replace(/\.(\w)/, (_, letter: string) => letter.toUpperCase())}.title`

  it('agree in French wherever they agree in English', () => {
    for (const entry of TOOL_COMMANDS) {
      const labelKey = labelKeyOf(entry)
      if (labelKey === undefined) continue

      const titleKey = titleKeyOf(entry.command)
      const unified = read(TRANSLATIONS.en, labelKey) === read(TRANSLATIONS.en, titleKey)
      if (!unified) continue

      expect(read(TRANSLATIONS.fr, labelKey), `${entry.command} is named twice`).toBe(
        read(TRANSLATIONS.fr, titleKey),
      )
    }
  })
})

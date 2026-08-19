import { describe, expect, it } from 'vitest'
import { isRecord } from '@shared/guards'
import { LANGUAGES, TRANSLATIONS, type Language } from '@shared/i18n'
import { PBR_CHANNELS, type PbrChannel } from '@shared/domain/texture'
import { DEFAULT_PREVIEW, PREVIEW_SHAPES, TILING_PREVIEWS } from '@/engines/texture/textureState'
import {
  channelFrom,
  MATERIAL_MODE,
  nextIn,
  nextInspected,
  shapeFrom,
  textureTools,
  tilingFrom,
} from './textureTools'

const input = (overrides: Partial<Parameters<typeof textureTools>[0]> = {}) => ({
  preview: DEFAULT_PREVIEW,
  inspected: null,
  filled: [],
  ...overrides,
})

function resolve(code: Language, key: string): unknown {
  const bundle: unknown = TRANSLATIONS[code]
  return key
    .split('.')
    .reduce<unknown>((current, part) => (isRecord(current) ? current[part] : undefined), bundle)
}

describe('the texture bar registry', () => {
  /**
   * Every key it names, in both bundles. There is no reader of a `.mtlx` on this machine and no
   * screen in a test, so what stands in for looking at the bar is that each of its labels
   * RESOLVES — a missing one paints its own key onto a button, which is the repository's most
   * expensive defect.
   */
  it('names nothing a bundle does not hold', () => {
    const keys = textureTools(input({ filled: PBR_CHANNELS })).flatMap(tool => [
      tool.labelKey,
      ...(tool.descriptionKey ? [tool.descriptionKey] : []),
      ...(tool.modes ?? []).flatMap(mode => [mode.labelKey, mode.descriptionKey]),
    ])

    const missing = LANGUAGES.map(language => language.code).flatMap(code =>
      keys.filter(key => typeof resolve(code, key) !== 'string').map(key => `${code}:${key}`),
    )

    expect(missing).toEqual([])
  })

  it('wears the shape in use, so the support is legible without opening anything', () => {
    const tools = textureTools(input({ preview: { ...DEFAULT_PREVIEW, shape: 'plane' } }))
    const shape = tools.find(tool => tool.id === 'shape')

    expect(shape?.activeMode).toBe('plane')
    expect(shape?.icon).toBe(shape?.modes?.find(mode => mode.id === 'plane')?.icon)
  })

  /**
   * A channel with no picture has nothing to show flat: inspecting it left the viewport black,
   * which is indistinguishable from a map of black pixels.
   */
  it('greys the channels this texture has not filled', () => {
    const rows = textureTools(input({ filled: ['baseColor'] })).find(
      tool => tool.id === 'channel',
    )?.modes

    expect(rows?.find(row => row.id === 'baseColor')?.disabled).toBe(false)
    expect(rows?.find(row => row.id === 'normal')?.disabled).toBe(true)
    // The lit material is always reachable — it is not a channel and needs none to be filled.
    expect(rows?.find(row => row.id === MATERIAL_MODE)?.disabled).toBeUndefined()
  })

  it('shows the three toggles as pressed exactly when they are on', () => {
    const preview = { ...DEFAULT_PREVIEW, showSeam: true, showBackground: false, autoSpin: true }
    const tools = textureTools(input({ preview }))
    const pressed = (id: string) => tools.find(tool => tool.id === id)?.pressed

    expect([pressed('seam'), pressed('background'), pressed('spin')]).toEqual([true, false, true])
  })
})

describe('reading a row back', () => {
  it('turns each row of the three choosing groups into its own value', () => {
    expect(PREVIEW_SHAPES.map(shape => shapeFrom(shape))).toEqual([...PREVIEW_SHAPES])
    expect(PBR_CHANNELS.map(channel => channelFrom(channel))).toEqual([...PBR_CHANNELS])
    expect(TILING_PREVIEWS.map(times => tilingFrom(String(times)))).toEqual([...TILING_PREVIEWS])
  })

  /** The row that gives the lit material back is not a channel, and `null` is what it means. */
  it('answers null for the material row and for a row from nowhere', () => {
    expect(channelFrom(MATERIAL_MODE)).toBeNull()
    expect(shapeFrom('donut')).toBeNull()
    expect(tilingFrom('3')).toBeNull()
  })
})

describe('stepping to the next entry', () => {
  it('wraps round the end of the list', () => {
    expect(nextIn(TILING_PREVIEWS, 1)).toBe(2)
    expect(nextIn(TILING_PREVIEWS, 4)).toBe(1)
  })

  /** A value the list does not hold would otherwise land on the second entry, from index -1. */
  it('falls back to the first entry when the current value is not in the list', () => {
    expect(nextIn(['a', 'b'], 'z')).toBe('a')
  })

  it('steps through the lit material and the filled channels alone', () => {
    const filled: readonly PbrChannel[] = ['baseColor', 'roughness']

    expect(nextInspected(filled, null)).toBe('baseColor')
    expect(nextInspected(filled, 'baseColor')).toBe('roughness')
    expect(nextInspected(filled, 'roughness')).toBeNull()
  })

  /**
   * A channel emptied while it was the one being looked at: the cycle has to take the material as
   * its starting point again, rather than answering from a position that no longer exists.
   */
  it('starts over from the material when the inspected channel has been emptied', () => {
    expect(nextInspected(['normal'], 'baseColor')).toBe('normal')
  })

  /** Registry order, not fill order: a cycle that follows what was dropped first moves under
   * the hand from one texture to the next. */
  it('follows the registry order rather than the order they were filled', () => {
    expect(nextInspected(['roughness', 'baseColor'], null)).toBe('baseColor')
  })
})

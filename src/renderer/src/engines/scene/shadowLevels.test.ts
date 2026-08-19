import { describe, expect, it } from 'vitest'
import type { ViewportQuality } from '@shared/domain/scene'
import {
  SHADOW_LEVELS,
  shadowLevelOf,
  shadowPreferenceFor,
  shadowsCapped,
  type ShadowLevel,
} from './shadowLevels'

const DRAWN: readonly ShadowLevel[] = ['fast', 'standard', 'high']

const held = (level: ShadowLevel, quality: ViewportQuality = 'high') => ({
  ...shadowPreferenceFor(level),
  quality,
})

describe('shadow levels', () => {
  it('reads back as the level just written', () => {
    for (const level of SHADOW_LEVELS) {
      expect(shadowLevelOf(held(level))).toBe(level)
    }
  })

  it('gives each drawn level a map of its own, so the choice is visible', () => {
    const sizes = DRAWN.map(level => shadowPreferenceFor(level).shadowMapSize)

    expect(new Set(sizes).size).toBe(DRAWN.length)
  })

  it('says custom for a combination no level names', () => {
    expect(
      shadowLevelOf({ shadows: true, shadowQuality: 'hard', shadowMapSize: 4096, quality: 'high' }),
    ).toBe(null)
  })

  // With nothing drawn, a map size is not a difference anybody can see: reporting « custom »
  // there would ask a reader to reconcile two numbers that no longer matter.
  it('says off whatever the fine settings hold, once shadows are off', () => {
    expect(
      shadowLevelOf({ shadows: false, shadowQuality: 'hard', shadowMapSize: 512, quality: 'high' }),
    ).toBe('off')
  })

  /**
   * Read off what was CHOSEN. Reading through the cap collapsed `standard` and `high` onto one
   * size at the default quality, and the High button unpressed itself the moment it was clicked.
   */
  it('reads the level that was chosen, whatever the viewport quality caps it to', () => {
    for (const quality of ['performance', 'balanced', 'high'] satisfies ViewportQuality[]) {
      expect(shadowLevelOf(held('high', quality))).toBe('high')
    }
  })

  it('says so when the quality is holding the shadows below what was asked for', () => {
    expect(shadowsCapped(held('high', 'performance'))).toBe(true)
    expect(shadowsCapped(held('high', 'high'))).toBe(false)
    // Nothing to cap when nothing is drawn.
    expect(shadowsCapped(held('off', 'performance'))).toBe(false)
  })
})

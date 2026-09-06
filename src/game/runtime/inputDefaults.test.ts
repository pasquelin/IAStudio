// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest'
import { inputMapPreset, type InputPresetId } from '@shared/domain/inputPresets'
import { withDefaultInputMaps } from './inputDefaults'

/**
 * The half of the carve-out a suite can hold: the runtime ships without `@shared/`, so it copies
 * these maps — and a test ships nowhere, so it may read both and refuse a drift.
 */
describe('the input contexts a scene falls back on', () => {
  const PLAYED: readonly InputPresetId[] = ['character', 'vehicle', 'flight']

  it('says exactly what the preset says, for the three a game plays with', () => {
    expect(withDefaultInputMaps([])).toEqual(PLAYED.map(inputMapPreset))
  })

  it('leaves what the project declares alone, and completes the rest', () => {
    const own = { version: 1, id: 'character', priority: 0, defaultActive: true, actions: [] }

    const completed = withDefaultInputMaps([own])

    expect(completed[0]).toBe(own)
    expect(completed.map(map => map.id)).toEqual(['character', 'vehicle', 'flight'])
  })
})

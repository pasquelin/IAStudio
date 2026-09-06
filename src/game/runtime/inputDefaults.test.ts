// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest'
import type { InputMap } from '@shared/domain/inputMap'
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

  it('completes a declared context ACTION by action, never wholesale', () => {
    const own = {
      version: 1,
      id: 'character',
      priority: 0,
      defaultActive: true,
      actions: [{ id: 'jump', kind: 'button', bindings: [] }],
    } satisfies InputMap

    const [completed] = withDefaultInputMaps([own])

    // The author's own answer is kept whole; what predates an action is filled in behind it.
    expect(completed?.actions[0]).toEqual(own.actions[0])
    expect(completed?.actions.map(action => action.id)).toContain('run')
  })

  it('keeps the project map in place and adds only the contexts it left out', () => {
    const own = { version: 1, id: 'character', priority: 7, defaultActive: false, actions: [] }

    const completed = withDefaultInputMaps([own])

    // Its own priority and its own switch, untouched — only the actions behind them are filled.
    expect(completed[0]).toMatchObject({ id: 'character', priority: 7, defaultActive: false })
    expect(completed.map(map => map.id)).toEqual(['character', 'vehicle', 'flight'])
  })
})

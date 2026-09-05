import { describe, expect, it } from 'vitest'
import { inputMapPreset, INPUT_PRESET_IDS } from './inputPresets'

describe('input presets', () => {
  it('offers a ready-to-play context for every simple workflow', () => {
    expect(INPUT_PRESET_IDS).toEqual(['studio', 'character', 'vehicle', 'flight', 'menu'])
    expect(inputMapPreset('studio').actions.map(action => action.id)).toEqual([
      'navigate',
      'confirm',
      'back',
    ])
    expect(inputMapPreset('character').actions.map(action => action.id)).toEqual([
      'move',
      'look',
      'jump',
      'interact',
    ])
  })
})

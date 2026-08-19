import { describe, expect, it } from 'vitest'
import { DEFAULT_WORLD } from '@shared/domain/scene'
import { ENVIRONMENT_PRESETS, matchesPreset, presetOf, presetPatch } from './environmentPresets'

describe('environment presets', () => {
  it('reads back as the preset just applied', () => {
    for (const preset of ENVIRONMENT_PRESETS) {
      expect(presetOf({ ...DEFAULT_WORLD, ...presetPatch(preset) })).toBe(preset)
    }
  })

  it('stops claiming a preset once anything it sets has moved', () => {
    const applied = { ...DEFAULT_WORLD, ...presetPatch('night') }

    expect(presetOf({ ...applied, exposure: 0.5 })).toBe(null)
  })

  it('leaves alone what it does not set', () => {
    // Night says nothing about the ground, so a ground somebody turned on survives it.
    const ground = { visible: true, color: '#123456', size: 12, opacity: 1, receiveShadow: true }
    const applied = { ...DEFAULT_WORLD, ground, ...presetPatch('night') }

    expect(applied.ground).toBe(ground)
    expect(matchesPreset(applied, 'night')).toBe(true)
  })

  it('touches no node: a preset is an environment, never a light of the scene', () => {
    for (const preset of ENVIRONMENT_PRESETS) {
      expect(Object.keys(presetPatch(preset))).not.toContain('nodes')
    }
  })

  it('gives each preset something visibly its own', () => {
    // The whole of §35: a preset that changed nothing would be a button that lies.
    const painted = ENVIRONMENT_PRESETS.map(preset =>
      JSON.stringify({ ...DEFAULT_WORLD, ...presetPatch(preset) }),
    )

    expect(new Set(painted).size).toBe(ENVIRONMENT_PRESETS.length)
  })

  it('is the outdoor preset alone that lets the sky be the backdrop', () => {
    const skyBacked = ENVIRONMENT_PRESETS.filter(
      preset => presetPatch(preset).background?.kind === 'environment',
    )

    expect(skyBacked).toEqual(['outdoor'])
  })
})

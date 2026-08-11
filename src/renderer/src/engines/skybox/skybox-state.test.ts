import { describe, expect, it } from 'vitest'
import { NEUTRAL_ADJUSTMENTS } from '@shared/domain/adjustments'
import { POLE_LIMIT } from '@shared/domain/angles'
import { createSkyboxContent, DEFAULT_SUN, type SkyboxContent } from '@shared/domain/skybox'
import { parseSkybox } from './skybox-state'

const filled: SkyboxContent = {
  source: { assetId: 'asset-a' },
  adjustments: { ...NEUTRAL_ADJUSTMENTS, exposure: 1.5, rotationY: 0.25 },
  sun: { elevation: 0.4, azimuth: 1.2, intensity: 2, color: '#ffcc88' },
  environment: { intensity: 0.5, showBackground: false },
  generation: { modelId: 'model-a', modelLabel: 'Model A', prompt: 'a dawn', seed: 7 },
}

describe('reading a sky back', () => {
  it('survives a serialize/parse round trip unchanged', () => {
    expect(parseSkybox(JSON.parse(JSON.stringify(filled)))).toEqual(filled)
  })

  it('falls back to a fresh sky rather than throwing on a shape it cannot read', () => {
    expect(parseSkybox('not a record')).toEqual(createSkyboxContent())
    expect(parseSkybox(null)).toEqual(createSkyboxContent())
  })

  it('fills in every section a file left out', () => {
    expect(parseSkybox({})).toEqual(createSkyboxContent())
  })

  // An empty id resolves to no file, which the engine cannot tell from a sky that is black.
  it('drops a source carrying no asset id', () => {
    expect(parseSkybox({ source: { assetId: '' } }).source).toBeNull()
    expect(parseSkybox({ source: 'asset-a' }).source).toBeNull()
  })

  it('clamps a sun elevation off the pole, where the azimuth stops meaning anything', () => {
    expect(parseSkybox({ sun: { elevation: 99 } }).sun.elevation).toBe(POLE_LIMIT)
  })

  it('wraps a negative azimuth, so two suns aiming the same way compare equal', () => {
    const { azimuth } = parseSkybox({ sun: { azimuth: -Math.PI / 2 } }).sun
    expect(azimuth).toBeCloseTo((3 * Math.PI) / 2)
  })

  it('refuses a negative intensity for the sun and for the environment', () => {
    expect(parseSkybox({ sun: { intensity: -3 } }).sun.intensity).toBe(0)
    expect(parseSkybox({ environment: { intensity: -3 } }).environment.intensity).toBe(0)
  })

  it('takes the stored defaults for a sun field that is not a number', () => {
    expect(parseSkybox({ sun: { intensity: 'loud' } }).sun.intensity).toBe(DEFAULT_SUN.intensity)
  })

  /*
   * Two classes, and only the second is a defect on its own: `#fff` renders and the control
   * normalises it, so refusing it buys one spelling rather than two; `banana` is the one three.js
   * refuses, where the sun silently keeps the colour it already had.
   */
  it('takes the stored default for a sun colour this studio would not have written', () => {
    expect(parseSkybox({ sun: { color: '#fff' } }).sun.color).toBe(DEFAULT_SUN.color)
    expect(parseSkybox({ sun: { color: 'banana' } }).sun.color).toBe(DEFAULT_SUN.color)
  })

  // A prompt credited to no model names a picture the panel cannot offer to make again.
  it('drops a provenance naming no model', () => {
    expect(parseSkybox({ generation: { prompt: 'a dawn' } }).generation).toBeUndefined()
  })

  it('keeps a provenance without a seed rather than inventing one', () => {
    expect(parseSkybox({ generation: { modelId: 'model-a' } }).generation).toEqual({
      modelId: 'model-a',
      modelLabel: 'model-a',
      prompt: '',
    })
  })
})

import { describe, expect, it } from 'vitest'
import { DEFAULT_TEXTURE_MATERIAL } from '@shared/domain/material'
import { modelFinishOf } from './modelFinish'

describe('what a material is worth to a model', () => {
  /**
   * The four a scene cannot draw: the two ranges and the green flip are read in the texture
   * engine's `onBeforeCompile`, the cavity in its own uniform. Carried across, they would promise
   * a look the viewport has no shader for.
   */
  it('drops the dials no plain standard material carries', () => {
    const finish = modelFinishOf(DEFAULT_TEXTURE_MATERIAL)

    expect(finish).not.toHaveProperty('roughnessRange')
    expect(finish).not.toHaveProperty('metalnessRange')
    expect(finish).not.toHaveProperty('invertNormalGreen')
    expect(finish).not.toHaveProperty('edgeIntensity')
  })

  it('carries the finish and the placement of the maps', () => {
    const finish = modelFinishOf({
      ...DEFAULT_TEXTURE_MATERIAL,
      roughness: 0.25,
      tiling: { x: 4, y: 2 },
      rotation: 1.5,
    })

    expect(finish.roughness).toBe(0.25)
    expect(finish.tiling).toEqual({ x: 4, y: 2 })
    expect(finish.rotation).toBe(1.5)
  })

  // Copied, never shared: the material of an open document keeps changing, and a scene holding a
  // reference into it would drift with every slider — and write that drift into its own file.
  it('copies the vectors rather than pointing at them', () => {
    const material = { ...DEFAULT_TEXTURE_MATERIAL, tiling: { x: 3, y: 3 } }

    expect(modelFinishOf(material).tiling).not.toBe(material.tiling)
  })
})

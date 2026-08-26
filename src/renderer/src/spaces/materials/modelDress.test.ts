import { describe, expect, it } from 'vitest'
import { DEFAULT_TEXTURE_MATERIAL } from '@shared/domain/material'
import { newMaterial, type ChannelMap, type MaterialState } from '@/engines/material/materialState'
import { modelDressOf } from './modelDress'

const materialWith = (over: Partial<MaterialState> = {}): MaterialState => ({
  ...newMaterial(),
  ...over,
})

const channel = (assetId: string): ChannelMap => ({
  assetId,
  origin: 'imported',
  width: 0,
  height: 0,
})

describe('what a material is worth to a model', () => {
  /**
   * The four a scene cannot draw: the two ranges and the green flip are read in the material
   * engine's `onBeforeCompile`, the cavity in its own uniform. Carried across, they would promise
   * a look the viewport has no shader for.
   */
  it('drops the dials no plain standard material carries', () => {
    const { material } = modelDressOf(materialWith())

    expect(material).not.toHaveProperty('roughnessRange')
    expect(material).not.toHaveProperty('metalnessRange')
    expect(material).not.toHaveProperty('invertNormalGreen')
    expect(material).not.toHaveProperty('edgeIntensity')
  })

  it('carries the finish and the placement of the maps', () => {
    const { material } = modelDressOf(
      materialWith({
        material: {
          ...DEFAULT_TEXTURE_MATERIAL,
          roughness: 0.25,
          tiling: { x: 4, y: 2 },
          rotation: 1.5,
        },
      }),
    )

    expect(material.roughness).toBe(0.25)
    expect(material.tiling).toEqual({ x: 4, y: 2 })
    expect(material.rotation).toBe(1.5)
  })

  /**
   * Copied, never shared: what the model wears is read afresh on every pass, and handing the
   * engine the material's own vector would let a tiling written on one node reach the document.
   */
  it('copies the vectors rather than pointing at them', () => {
    const state = materialWith({
      material: { ...DEFAULT_TEXTURE_MATERIAL, tiling: { x: 3, y: 3 } },
    })

    expect(modelDressOf(state).material.tiling).not.toBe(state.material.tiling)
  })

  /** The eight channels a material holds land in the seven slots a scene reads. */
  it('puts each channel in the slot a scene reads it from', () => {
    const { textures } = modelDressOf(
      materialWith({
        channels: {
          baseColor: channel('albedo'),
          normal: channel('bump'),
          emissive: channel('glow'),
          height: channel('relief'),
        },
      }),
    )

    expect(textures).toEqual({
      map: { assetId: 'albedo' },
      normalMap: { assetId: 'bump' },
      emissiveMap: { assetId: 'glow' },
      displacementMap: { assetId: 'relief' },
    })
  })

  /** The cavity is the one channel a scene has no slot for — it is read in a shader of its own. */
  it('leaves out the one channel no slot of a scene reads', () => {
    const { textures } = modelDressOf(materialWith({ channels: { edge: channel('rim') } }))

    expect(textures).toEqual({})
  })
})

import { describe, expect, it } from 'vitest'
import { DEFAULT_TEXTURE_MATERIAL } from '@shared/domain/material'
import { newMaterial, type ChannelMap, type MaterialState } from '@/engines/material/materialState'
import type { ModelDressRef } from '@shared/domain/scene'
import { modelDressOf, wornModelDress } from './modelDress'

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

    expect(material?.roughness).toBe(0.25)
    expect(material?.tiling).toEqual({ x: 4, y: 2 })
    expect(material?.rotation).toBe(1.5)
  })

  /**
   * Copied, never shared: what the model wears is read afresh on every pass, and handing the
   * engine the material's own vector would let a tiling written on one node reach the document.
   */
  it('copies the vectors rather than pointing at them', () => {
    const state = materialWith({
      material: { ...DEFAULT_TEXTURE_MATERIAL, tiling: { x: 3, y: 3 } },
    })

    expect(modelDressOf(state).material?.tiling).not.toBe(state.material.tiling)
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

describe('what a model’s dress is worth to one of its slots', () => {
  /**
   * The simple mode covers the WHOLE model, so every slot answers the same thing — a car body and
   * its glass both take the picture. Answering it for slot 0 alone is how the rest of a
   * multi-material mesh would keep its own maps while the first changed.
   */
  it('answers the same picture for every slot of a model covered by an image', () => {
    const dress: ModelDressRef = { kind: 'image', assetId: 'brick' }

    expect(wornModelDress(dress, 0)?.textures).toEqual({ map: { assetId: 'brick' } })
    expect(wornModelDress(dress, 3)?.textures).toEqual({ map: { assetId: 'brick' } })
  })

  /**
   * Nothing is derived from a picture: it is a base colour and says nothing about the rest. An
   * EMPTY finish is not the same as none — `wear` writes `needsUpdate` on one and returns on the
   * other, so an empty one costs a program invalidation per material on every catalogue refresh.
   */
  it('names no finish at all for a picture', () => {
    expect(wornModelDress({ kind: 'image', assetId: 'brick' }, 0)?.material).toBeUndefined()
  })

  // The mode is chosen and the picture is not — the panel has to stay in it, so this is a state.
  it('dresses nothing while the image mode holds no picture yet', () => {
    expect(wornModelDress({ kind: 'image', assetId: '' }, 0)).toBeNull()
  })

  /**
   * A slot the list does not reach wears its OWN material — the file may carry more than the user
   * has named. Answering the last one named instead would repaint a car's tyres with its body.
   */
  it('dresses nothing for a slot the material list does not reach', () => {
    const dress: ModelDressRef = { kind: 'materials', documentIds: ['mat-1'] }

    expect(wornModelDress(dress, 1)).toBeNull()
    expect(wornModelDress(dress, 0)).toBeNull()
  })

  // An empty entry is a slot kept and not filled, which is not the same as a slot that is absent —
  // but both leave the model in its own material, and neither may ask the project for a file.
  it('dresses nothing for a slot left empty on purpose', () => {
    expect(wornModelDress({ kind: 'materials', documentIds: ['', 'mat-2'] }, 0)).toBeNull()
  })
})

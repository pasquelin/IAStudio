import { describe, expect, it } from 'vitest'
import { newMaterial, type MaterialState } from '../materialState'
import { exportChannelsOf } from './channels'

function textureWith(changes: Partial<MaterialState> = {}): MaterialState {
  return { ...newMaterial(), ...changes }
}

describe('the channels an export reads', () => {
  it('carries nothing for a texture with no channels', () => {
    expect(exportChannelsOf(newMaterial())).toEqual({})
  })

  it('keeps the asset of each channel that has one', () => {
    const texture = textureWith({
      channels: {
        baseColor: { assetId: 'a-base', origin: 'generated', width: 1024, height: 512 },
        ao: { assetId: 'a-ao', origin: 'derived', width: 512, height: 512 },
      },
    })

    expect(exportChannelsOf(texture)).toEqual({
      baseColor: { assetId: 'a-base' },
      ao: { assetId: 'a-ao' },
    })
  })

  /** The document's own numbers are what the file said when it was written, not what it holds. */
  it('drops the stored size, which the decoded picture answers better', () => {
    const texture = textureWith({
      channels: {
        baseColor: { assetId: 'a-base', origin: 'imported', width: 4096, height: 2048 },
      },
    })

    expect(exportChannelsOf(texture).baseColor).not.toHaveProperty('width')
    expect(exportChannelsOf(texture).baseColor).not.toHaveProperty('height')
  })

  it('carries a channel stored the other way round as such', () => {
    const texture = textureWith({
      channels: {
        roughness: {
          assetId: 'a-rough',
          origin: 'generated',
          width: 512,
          height: 512,
          inverted: true,
        },
      },
    })

    expect(exportChannelsOf(texture).roughness).toMatchObject({
      assetId: 'a-rough',
      inverted: true,
    })
  })

  it('brings the green convention down from the material onto the normal', () => {
    const texture = textureWith({
      channels: {
        normal: { assetId: 'a-normal', origin: 'derived', width: 512, height: 512 },
        ao: { assetId: 'a-ao', origin: 'derived', width: 512, height: 512 },
      },
      material: { ...newMaterial().material, invertNormalGreen: true },
    })

    const exported = exportChannelsOf(texture)

    expect(exported.normal).toEqual({ assetId: 'a-normal', greenFlipped: true })
    // And onto nothing else: the setting reads the normal's green and only that.
    expect(exported.ao).toEqual({ assetId: 'a-ao' })
  })

  it('says nothing of the convention when the material does not', () => {
    const texture = textureWith({
      channels: { normal: { assetId: 'a-normal', origin: 'derived', width: 512, height: 512 } },
    })

    expect(exportChannelsOf(texture).normal).toEqual({ assetId: 'a-normal' })
  })
})

describe('the remap window an export carries', () => {
  it('carries the double handle of the two channels that have one', () => {
    const texture = textureWith({
      channels: {
        roughness: { assetId: 'a-rough', origin: 'generated', width: 8, height: 8 },
        metalness: { assetId: 'a-metal', origin: 'generated', width: 8, height: 8 },
      },
      material: {
        ...newMaterial().material,
        roughnessRange: { min: 0.3, max: 0.7 },
        metalnessRange: { min: 0.1, max: 0.9 },
      },
    })

    const exported = exportChannelsOf(texture)

    expect(exported.roughness?.range).toEqual({ min: 0.3, max: 0.7 })
    expect(exported.metalness?.range).toEqual({ min: 0.1, max: 0.9 })
  })

  it('gives none to a channel the panel has no handle for', () => {
    const texture = textureWith({
      channels: {
        ao: { assetId: 'a-ao', origin: 'derived', width: 8, height: 8 },
        baseColor: { assetId: 'a-base', origin: 'imported', width: 8, height: 8 },
      },
    })

    const exported = exportChannelsOf(texture)

    expect(exported.ao).not.toHaveProperty('range')
    expect(exported.baseColor).not.toHaveProperty('range')
  })

  it('carries the identity window where the handles were never moved', () => {
    const texture = textureWith({
      channels: { roughness: { assetId: 'a-rough', origin: 'generated', width: 8, height: 8 } },
    })

    expect(exportChannelsOf(texture).roughness?.range).toEqual({ min: 0, max: 1 })
  })
})

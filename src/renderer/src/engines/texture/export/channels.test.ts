import { describe, expect, it } from 'vitest'
import { newTexture, type TextureState } from '../texture-state'
import { exportChannelsOf } from './channels'

function textureWith(changes: Partial<TextureState> = {}): TextureState {
  return { ...newTexture(), ...changes }
}

describe('the channels an export reads', () => {
  it('carries nothing for a texture with no channels', () => {
    expect(exportChannelsOf(newTexture())).toEqual({})
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

    expect(exportChannelsOf(texture).roughness).toEqual({ assetId: 'a-rough', inverted: true })
  })

  it('brings the green convention down from the material onto the normal', () => {
    const texture = textureWith({
      channels: {
        normal: { assetId: 'a-normal', origin: 'derived', width: 512, height: 512 },
        ao: { assetId: 'a-ao', origin: 'derived', width: 512, height: 512 },
      },
      material: { ...newTexture().material, invertNormalGreen: true },
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

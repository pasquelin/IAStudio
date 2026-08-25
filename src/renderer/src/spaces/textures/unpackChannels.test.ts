import { describe, expect, it, vi } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import { installFakeBridge } from '@/services/fakeBridge'
import { packedChannels, unpackTextureChannels } from './unpackChannels'

const packed = (overrides: Partial<Asset> = {}): Asset => ({
  id: 'asset-orm',
  name: 'Robot — metallicRoughness',
  type: 'texture',
  location: 'local',
  derivedFrom: 'asset-model',
  packedSlot: 'metallicRoughnessTexture',
  tags: [],
  createdAt: '2026-08-13T10:00:00.000Z',
  ...overrides,
})

const unpacked = () => Promise.resolve({ width: 2, height: 2, png: new Uint8Array([1]) })

describe('unpacking a packed picture', () => {
  /**
   * The whole reason `packedSlot` survives to the catalogue: a `clearcoatTexture` arrives with no
   * channel claimed too, and reading a roughness out of it would write a measurement of nothing.
   */
  it('offers nothing for a slot that packs no channel of the studio', () => {
    expect(packedChannels(packed({ packedSlot: 'clearcoatTexture' }))).toEqual([])
    expect(packedChannels(packed({ packedSlot: undefined }))).toEqual([])
  })

  it('names the two channels glTF packs into one picture', () => {
    expect(packedChannels(packed())).toEqual(['roughness', 'metalness'])
  })

  it('writes one asset per channel, each claiming the channel it holds', async () => {
    const saveTexture = vi.fn((request: { map?: string }) =>
      Promise.resolve(packed({ id: `asset-${request.map ?? ''}` })),
    )
    installFakeBridge({ assets: { saveTexture } })

    await expect(unpackTextureChannels(packed(), unpacked)).resolves.toBe(2)

    expect(saveTexture.mock.calls.map(([request]) => request.map)).toEqual([
      'roughness',
      'metalness',
    ])
  })

  // Traceable to what it came OUT of, never to the model: a second unpacking of the same file
  // must be tellable from the first, and the model already answers for the packed picture.
  it('files each one under the picture it was read from', async () => {
    const saveTexture = vi.fn((request: { derivedFrom?: string }) => {
      expect(request.derivedFrom).toBe('asset-orm')
      return Promise.resolve(packed())
    })
    installFakeBridge({ assets: { saveTexture } })

    await unpackTextureChannels(packed(), unpacked)

    expect(saveTexture).toHaveBeenCalledTimes(2)
  })

  it('does nothing at all for a picture nothing says packs channels', async () => {
    const saveTexture = vi.fn(() => Promise.resolve(packed()))
    installFakeBridge({ assets: { saveTexture } })

    await expect(
      unpackTextureChannels(packed({ packedSlot: 'clearcoatTexture' }), unpacked),
    ).resolves.toBe(0)
    expect(saveTexture).not.toHaveBeenCalled()
  })
})

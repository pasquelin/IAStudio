import { beforeEach, describe, expect, it } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import { textureOf, useTextures } from '@/stores/textures'
import { placeTextureChannel } from './place-channel'

const picture = (overrides: Partial<Asset> = {}): Asset => ({
  id: 'asset_1',
  name: 'moss.png',
  type: 'image',
  location: 'local',
  width: 1024,
  height: 512,
  tags: [],
  createdAt: '2026-08-07T10:00:00.000Z',
  ...overrides,
})

const channelsOf = () => textureOf(useTextures.getState(), 'doc-1').channels

describe('putting a picture into a channel of a material', () => {
  beforeEach(() => {
    useTextures.setState({ states: {}, histories: {} })
  })

  it('fills the base colour, which is what a bare drop means', () => {
    expect(placeTextureChannel('doc-1', picture())).toBe(true)

    expect(channelsOf().baseColor).toMatchObject({ assetId: 'asset_1', origin: 'imported' })
  })

  it('carries the size across, since the strip is judged against it', () => {
    placeTextureChannel('doc-1', picture())

    expect(channelsOf().baseColor).toMatchObject({ width: 1024, height: 512 })
  })

  // An asset the API measured but the catalogue has not: zero is what the renderer reads as
  // "not known yet", rather than a size that would be wrong.
  it('writes a zero size for a picture nothing has measured', () => {
    placeTextureChannel('doc-1', picture({ width: undefined, height: undefined }))

    expect(channelsOf().baseColor).toMatchObject({ width: 0, height: 0 })
  })

  it('fills a named channel when the slot says which', () => {
    placeTextureChannel('doc-1', picture(), 'normal')

    expect(channelsOf().normal).toMatchObject({ assetId: 'asset_1' })
    expect(channelsOf().baseColor).toBeUndefined()
  })

  // A cloud asset has no file to decode yet, so the renderer would load a 404 into a slot it
  // cannot tell from an empty one.
  it('refuses a picture the cloud still holds, and says so', () => {
    expect(placeTextureChannel('doc-1', picture({ location: 'cloud' }))).toBe(false)

    expect(channelsOf().baseColor).toBeUndefined()
  })

  it('refuses anything that is not a picture', () => {
    expect(placeTextureChannel('doc-1', picture({ type: 'audio' }))).toBe(false)

    expect(channelsOf().baseColor).toBeUndefined()
  })

  it('leaves an undo step behind, so a wrong drop is one keystroke away from gone', () => {
    placeTextureChannel('doc-1', picture())
    placeTextureChannel('doc-1', picture({ id: 'asset_2' }))

    expect(channelsOf().baseColor).toMatchObject({ assetId: 'asset_2' })
    expect(useTextures.getState().histories['doc-1']?.past.length).toBeGreaterThan(0)
  })
})

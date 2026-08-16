import { beforeEach, describe, expect, it } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import { bridgeWatchingLogs } from '@/services/fake-bridge'
import { forgetReportedFailures } from '@/services/diagnostics'
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
    forgetReportedFailures()
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
  /**
   * And says so for real. `AssetDropTarget` cannot refuse this while it flies — a drag announces
   * its type, not where its file is — so nine surfaces painted an accepting outline and then did
   * nothing at all, which that component's own JSDoc calls the worse of the two.
   */
  it('refuses a picture the cloud still holds, and says so', () => {
    const bridge = bridgeWatchingLogs()

    expect(placeTextureChannel('doc-1', picture({ location: 'cloud' }))).toBe(false)

    expect(channelsOf().baseColor).toBeUndefined()
    expect(bridge.report).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'error', scope: 'texture.channel' }),
    )
  })

  /** A drop is a gesture: the second one has to speak too, or the user drops again and again. */
  it('says it every time, not once', () => {
    const bridge = bridgeWatchingLogs()
    const cloud = picture({ location: 'cloud' })

    placeTextureChannel('doc-1', cloud)
    placeTextureChannel('doc-1', cloud)

    expect(bridge.report).toHaveBeenCalledTimes(2)
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

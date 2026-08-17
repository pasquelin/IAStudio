import { beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyAssetCounts, type Asset } from '@shared/domain/asset'
import { installFakeBridge } from '@/services/fakeBridge'
import { runAction } from './executor'

const ASSET: Asset = {
  id: 'asset-1',
  name: 'Boulder',
  type: 'image',
  location: 'local',
  tags: [],
  createdAt: '2026-08-17T10:00:00.000Z',
}

beforeEach(() => {
  installFakeBridge()
})

describe('searching the library', () => {
  it('passes only the narrowings it was given', async () => {
    const search = vi.fn(async () => [])
    installFakeBridge({ assets: { search } })

    await runAction('assets.search', { text: 'stone', type: 'texture', tags: ['pbr'], limit: 10 })
    expect(search).toHaveBeenCalledWith({
      text: 'stone',
      type: 'texture',
      tags: ['pbr'],
      limit: 10,
    })

    await runAction('assets.search', {})
    expect(search).toHaveBeenLastCalledWith({})
  })

  /**
   * "Everything that was NOT generated" is a question the catalogue does not answer, so the flag
   * only ever travels affirmatively — `generated: false` would silently mean "no filter" and
   * hand back imports as well.
   */
  it('asks about generated assets only when asked to', async () => {
    const search = vi.fn(async () => [])
    installFakeBridge({ assets: { search } })

    await runAction('assets.search', { generated: true })
    expect(search).toHaveBeenCalledWith({ generated: true })

    await runAction('assets.search', { generated: false })
    expect(search).toHaveBeenLastCalledWith({})
  })

  it('counts the library in the catalogue rather than by listing it', async () => {
    const counts = emptyAssetCounts()
    installFakeBridge({ assets: { counts: vi.fn(async () => counts) } })

    expect(await runAction('assets.counts', {})).toEqual({ ok: true, data: counts })
  })
})

describe('reading and correcting an asset', () => {
  /**
   * Through the catalogue, NOT through `assets.describe` — that one is the captioning channel
   * and calls the API. Reading a generation's output must cost nothing.
   */
  it('reads the ids a finished generation handed back, out of the catalogue', async () => {
    const search = vi.fn(async () => [])
    installFakeBridge({ assets: { search } })

    await runAction('asset.get', { assetIds: ['asset-1', 'asset-2'] })
    expect(search).toHaveBeenCalledWith({ ids: ['asset-1', 'asset-2'], limit: 2 })
  })

  /**
   * Tags are replaced whole by the channel, so an empty list is a real instruction — "clear
   * them" — and an absent field is "leave them alone". Reading the KEY rather than the list is
   * what tells the two apart.
   */
  it('clears tags when given an empty list, and leaves them alone when given none', async () => {
    const update = vi.fn(async () => ASSET)
    installFakeBridge({ assets: { update } })

    await runAction('asset.update', { assetId: 'asset-1', tags: [] })
    expect(update).toHaveBeenCalledWith('asset-1', { tags: [] })

    await runAction('asset.update', { assetId: 'asset-1', name: 'Stone' })
    expect(update).toHaveBeenLastCalledWith('asset-1', { name: 'Stone' })
  })

  it('refuses a change that changes nothing rather than writing an empty one', async () => {
    const update = vi.fn(async () => ASSET)
    installFakeBridge({ assets: { update } })

    expect(await runAction('asset.update', { assetId: 'asset-1' })).toEqual({
      ok: false,
      refusal: 'badInput',
    })
    expect(update).not.toHaveBeenCalled()
  })

  it('removes assets locally, and remotely only when asked', async () => {
    const remove = vi.fn(async () => {})
    installFakeBridge({ assets: { remove } })

    await runAction('assets.remove', { assetIds: ['asset-1'] })
    expect(remove).toHaveBeenCalledWith(['asset-1'], false)

    await runAction('assets.remove', { assetIds: ['asset-1'], alsoRemote: true })
    expect(remove).toHaveBeenLastCalledWith(['asset-1'], true)
  })

  it('refuses an empty list rather than calling the channel with one', async () => {
    const remove = vi.fn(async () => {})
    installFakeBridge({ assets: { remove } })

    expect(await runAction('assets.remove', { assetIds: [] })).toEqual({
      ok: false,
      refusal: 'badInput',
    })
    expect(remove).not.toHaveBeenCalled()
  })
})

import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AssetType } from '@shared/domain/asset'
import type { CloudAsset, CloudPage } from '@shared/domain/cloud-asset'
import { installFakeBridge } from '@/services/fake-bridge'
import { useSettings } from '@/stores/settings'
import { useExplore } from './use-explore'

function cloudAsset(id: string, type: AssetType = 'image'): CloudAsset {
  return {
    id,
    name: `${id}.png`,
    type,
    remoteType: 'txt2img',
    ownerId: 'team_other',
    createdAt: '2026-08-08T10:00:00.000Z',
    updatedAt: '2026-08-08T10:00:00.000Z',
    privacy: 'public',
    tags: [],
    collectionIds: [],
  }
}

/** A feed served page by page, with the request log the assertions read. */
function install(pages: CloudPage[]) {
  let at = 0
  const explore = vi.fn(() => {
    const page = pages[Math.min(at, pages.length - 1)]
    at += 1
    return Promise.resolve(page ?? { assets: [], cursor: null })
  })

  installFakeBridge({ cloud: { explore } })
  return { explore }
}

beforeEach(() => {
  useSettings.setState({ auth: { authenticated: true, ownerId: 'team_1' } })
})

describe('one tab of the public feed', () => {
  it('reads the first page as it appears', async () => {
    const { explore } = install([{ assets: [cloudAsset('a')], cursor: null }])

    const { result } = renderHook(() => useExplore('image'))

    await waitFor(() => expect(result.current.assets).toHaveLength(1))
    expect(explore).toHaveBeenCalledWith(expect.objectContaining({ type: 'image' }))
  })

  it('appends the next page rather than replacing what is on screen', async () => {
    install([
      { assets: [cloudAsset('a')], cursor: 'o:40' },
      { assets: [cloudAsset('b')], cursor: null },
    ])

    const { result } = renderHook(() => useExplore('image'))
    await waitFor(() => expect(result.current.assets).toHaveLength(1))

    act(() => result.current.more())
    await waitFor(() => expect(result.current.assets.map(asset => asset.id)).toEqual(['a', 'b']))
  })

  it('carries the cursor the previous page handed back', async () => {
    const { explore } = install([
      { assets: [cloudAsset('a')], cursor: 'o:40' },
      { assets: [], cursor: null },
    ])

    const { result } = renderHook(() => useExplore('image'))
    await waitFor(() => expect(result.current.assets).toHaveLength(1))

    act(() => result.current.more())
    await waitFor(() => expect(explore).toHaveBeenCalledTimes(2))
    expect(explore).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: 'o:40' }))
  })

  it('tolerates being asked again before it has answered', async () => {
    // The grid asks on every frame it is near the end; one request may be in flight at a time.
    const { explore } = install([{ assets: [cloudAsset('a')], cursor: 'o:40' }])

    const { result } = renderHook(() => useExplore('image'))
    await waitFor(() => expect(result.current.assets).toHaveLength(1))

    act(() => {
      result.current.more()
      result.current.more()
      result.current.more()
    })

    await waitFor(() => expect(explore).toHaveBeenCalledTimes(2))
    expect(explore).toHaveBeenCalledTimes(2)
  })

  it('does not show the same asset twice when the feed shifted under the offset', async () => {
    // The index pages by offset over a feed that keeps growing: one publication between two
    // requests pushes everything down, and the last tile comes back at the top of the next page.
    install([
      { assets: [cloudAsset('a'), cloudAsset('b')], cursor: 'o:40' },
      { assets: [cloudAsset('b'), cloudAsset('c')], cursor: null },
    ])

    const { result } = renderHook(() => useExplore('image'))
    await waitFor(() => expect(result.current.assets).toHaveLength(2))

    act(() => result.current.more())
    await waitFor(() =>
      expect(result.current.assets.map(asset => asset.id)).toEqual(['a', 'b', 'c']),
    )
  })

  it('stops asking once the feed says there is no more', async () => {
    const { explore } = install([{ assets: [cloudAsset('a')], cursor: null }])

    const { result } = renderHook(() => useExplore('image'))
    await waitFor(() => expect(result.current.exhausted).toBe(true))

    act(() => result.current.more())
    expect(explore).toHaveBeenCalledTimes(1)
  })

  it('empties as the tab changes, so no tile outlives the question it answered', async () => {
    install([
      { assets: [cloudAsset('a')], cursor: null },
      { assets: [cloudAsset('b', 'video')], cursor: null },
    ])

    const { result, rerender } = renderHook(({ type }: { type: AssetType }) => useExplore(type), {
      initialProps: { type: 'image' },
    })
    await waitFor(() => expect(result.current.assets).toHaveLength(1))

    rerender({ type: 'video' })
    // Emptied during the render, not after it: a video tab showing pictures is a wrong answer,
    // not a slow one.
    expect(result.current.assets).toHaveLength(0)
    await waitFor(() => expect(result.current.assets.map(asset => asset.id)).toEqual(['b']))
  })

  it('empties when the key changes, since another key is another feed', async () => {
    install([
      { assets: [cloudAsset('a')], cursor: null },
      { assets: [cloudAsset('b')], cursor: null },
    ])

    const { result } = renderHook(() => useExplore('image'))
    await waitFor(() => expect(result.current.assets).toHaveLength(1))

    act(() => useSettings.setState({ auth: { authenticated: true, ownerId: 'team_2' } }))
    await waitFor(() => expect(result.current.assets.map(asset => asset.id)).toEqual(['b']))
  })

  it('keeps what is on screen when the API refuses, and stops', async () => {
    const explore = vi
      .fn<() => Promise<CloudPage>>()
      .mockResolvedValueOnce({ assets: [cloudAsset('a')], cursor: 'o:40' })
      .mockRejectedValueOnce(new Error('429'))
    installFakeBridge({ cloud: { explore } })

    const { result } = renderHook(() => useExplore('image'))
    await waitFor(() => expect(result.current.assets).toHaveLength(1))

    act(() => result.current.more())
    await waitFor(() => expect(result.current.exhausted).toBe(true))

    // A refusal is not a reason to blank a band that is already showing what was published.
    expect(result.current.assets).toHaveLength(1)
    expect(result.current.loading).toBe(false)
  })

  it('reports the first read as loading, which is not the same as nothing published', async () => {
    install([{ assets: [], cursor: null }])

    const { result } = renderHook(() => useExplore('image'))
    expect(result.current.loading).toBe(true)

    await waitFor(() => expect(result.current.loading).toBe(false))
  })
})

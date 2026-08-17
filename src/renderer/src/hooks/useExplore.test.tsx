import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AssetType } from '@shared/domain/asset'
import type { CloudAsset, CloudPage } from '@shared/domain/cloudAsset'
import { queryHost } from '@/app/query-fixtures'
import { installFakeBridge } from '@/services/fakeBridge'
import { useSettings } from '@/stores/settings'
import { useExplore } from './useExplore'

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

/**
 * What the feed does with the pages themselves — one row per id, a cursor that stops advancing,
 * a run of pages bringing nothing new — belongs to `usePages` and is held by its own suite. What
 * is here is what this tab decides: which endpoint, which key, and when it asks on its own.
 */
describe('one tab of the public feed', () => {
  it('reads the first page as it appears', async () => {
    const { explore } = install([{ assets: [cloudAsset('a')], cursor: null }])

    const { result } = renderHook(() => useExplore('image'), { wrapper: queryHost() })

    await waitFor(() => expect(result.current.assets).toHaveLength(1))
    expect(explore).toHaveBeenCalledWith(expect.objectContaining({ type: 'image' }))
  })

  it('carries the cursor the previous page handed back', async () => {
    const { explore } = install([
      { assets: [cloudAsset('a')], cursor: 'o:40' },
      { assets: [cloudAsset('b')], cursor: null },
    ])

    const { result } = renderHook(() => useExplore('image'), { wrapper: queryHost() })
    await waitFor(() => expect(result.current.assets).toHaveLength(1))

    act(() => result.current.more())
    await waitFor(() => expect(result.current.assets.map(asset => asset.id)).toEqual(['a', 'b']))
    expect(explore).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: 'o:40' }))
  })

  it('tolerates being asked again before it has answered', async () => {
    // The grid asks on every frame it is near the end; one request may be in flight at a time.
    const { explore } = install([{ assets: [cloudAsset('a')], cursor: 'o:40' }])

    const { result } = renderHook(() => useExplore('image'), { wrapper: queryHost() })
    await waitFor(() => expect(result.current.assets).toHaveLength(1))

    act(() => {
      result.current.more()
      result.current.more()
      result.current.more()
    })

    await waitFor(() => expect(explore).toHaveBeenCalledTimes(2))
    expect(explore).toHaveBeenCalledTimes(2)
  })

  it('walks past a page the studio narrowed away, rather than calling it the end', async () => {
    // The main process retypes the hits after the index answered, so a whole page can come back
    // empty with a cursor still live. The grid never asks again on an empty grid — so if the tab
    // stopped here, it would die on "nothing published" with pages still to come.
    install([
      { assets: [], cursor: 'o:40' },
      { assets: [], cursor: 'o:80' },
      { assets: [cloudAsset('a')], cursor: null },
    ])

    const { result } = renderHook(() => useExplore('image'), { wrapper: queryHost() })

    await waitFor(() => expect(result.current.assets.map(asset => asset.id)).toEqual(['a']))
  })

  it('stops asking once the feed says there is no more', async () => {
    const { explore } = install([{ assets: [cloudAsset('a')], cursor: null }])

    const { result } = renderHook(() => useExplore('image'), { wrapper: queryHost() })
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
      wrapper: queryHost(),
    })
    await waitFor(() => expect(result.current.assets).toHaveLength(1))

    rerender({ type: 'video' })
    // Emptied during the render, not after it: a video tab showing pictures is a wrong answer,
    // not a slow one.
    expect(result.current.assets).toHaveLength(0)
    await waitFor(() => expect(result.current.assets.map(asset => asset.id)).toEqual(['b']))
  })

  it('reads afresh under another account, since another account is another feed', async () => {
    install([
      { assets: [cloudAsset('a')], cursor: null },
      { assets: [cloudAsset('b')], cursor: null },
    ])

    const { result } = renderHook(() => useExplore('image'), { wrapper: queryHost() })
    await waitFor(() => expect(result.current.assets).toHaveLength(1))

    act(() => useSettings.setState({ auth: { authenticated: true, ownerId: 'team_2' } }))
    await waitFor(() => expect(result.current.assets.map(asset => asset.id)).toEqual(['b']))
  })

  it('keeps what is on screen when the API refuses', async () => {
    const explore = vi
      .fn<() => Promise<CloudPage>>()
      .mockResolvedValueOnce({ assets: [cloudAsset('a')], cursor: 'o:40' })
      .mockRejectedValue(new Error('429'))
    installFakeBridge({ cloud: { explore } })

    const { result } = renderHook(() => useExplore('image'), { wrapper: queryHost() })
    await waitFor(() => expect(result.current.assets).toHaveLength(1))

    act(() => result.current.more())
    await waitFor(() => expect(explore).toHaveBeenCalledTimes(2))

    // A refusal is not a reason to blank a band that is already showing what was published.
    expect(result.current.assets.map(asset => asset.id)).toEqual(['a'])
  })

  it('shows a tab already read without asking for it again', async () => {
    // Six tabs, each spending up to three searches on the main side: sweeping the row cost
    // eighteen calls to the endpoint the catalogue bills apart.
    const { explore } = install([
      { assets: [cloudAsset('a')], cursor: 'o:40' },
      { assets: [cloudAsset('b', 'video')], cursor: 'o:40' },
    ])

    const { result, rerender } = renderHook(({ type }: { type: AssetType }) => useExplore(type), {
      initialProps: { type: 'image' },
      wrapper: queryHost(),
    })
    await waitFor(() => expect(result.current.assets.map(asset => asset.id)).toEqual(['a']))

    rerender({ type: 'video' })
    await waitFor(() => expect(result.current.assets.map(asset => asset.id)).toEqual(['b']))

    rerender({ type: 'image' })
    expect(result.current.assets.map(asset => asset.id)).toEqual(['a'])
    expect(explore).toHaveBeenCalledTimes(2)
  })

  it('asks again on a tab the API had refused, rather than remembering the refusal', async () => {
    // The cache must not turn one 429 into a tab that reads "nothing published" for the rest of
    // the session — that is the failure this band was fixed for, one level up.
    const explore = vi
      .fn<() => Promise<CloudPage>>()
      .mockRejectedValueOnce(new Error('429'))
      .mockResolvedValue({ assets: [cloudAsset('a')], cursor: null })
    installFakeBridge({ cloud: { explore } })

    const { result, rerender } = renderHook(({ type }: { type: AssetType }) => useExplore(type), {
      initialProps: { type: 'image' },
      wrapper: queryHost(),
    })
    await waitFor(() => expect(result.current.exhausted).toBe(true))
    expect(result.current.assets).toHaveLength(0)

    rerender({ type: 'video' })
    rerender({ type: 'image' })

    await waitFor(() => expect(result.current.assets.map(asset => asset.id)).toEqual(['a']))
  })

  it('keeps a tab that genuinely ran out, and does not read it again', async () => {
    // The contrast: an exhausted feed is worth remembering, a refused one is not.
    const { explore } = install([
      { assets: [cloudAsset('a')], cursor: null },
      { assets: [cloudAsset('b', 'video')], cursor: null },
    ])

    const { result, rerender } = renderHook(({ type }: { type: AssetType }) => useExplore(type), {
      initialProps: { type: 'image' },
      wrapper: queryHost(),
    })
    await waitFor(() => expect(result.current.assets.map(asset => asset.id)).toEqual(['a']))

    rerender({ type: 'video' })
    await waitFor(() => expect(result.current.assets.map(asset => asset.id)).toEqual(['b']))
    rerender({ type: 'image' })

    expect(result.current.assets.map(asset => asset.id)).toEqual(['a'])
    expect(explore).toHaveBeenCalledTimes(2)
  })

  it('does not call the feed empty before it has run out', async () => {
    // `exhausted` is the only thing allowed to mean "nothing published": before it, the first
    // round trip has not even come back.
    install([{ assets: [], cursor: null }])

    const { result } = renderHook(() => useExplore('image'), { wrapper: queryHost() })
    expect(result.current.exhausted).toBe(false)

    await waitFor(() => expect(result.current.exhausted).toBe(true))
  })
})

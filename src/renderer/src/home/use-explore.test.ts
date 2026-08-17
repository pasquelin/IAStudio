import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AssetType } from '@shared/domain/asset'
import type { CloudAsset, CloudPage } from '@shared/domain/cloud-asset'
import { installFakeBridge } from '@/services/fakeBridge'
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

/** The page that first brought something, plus the barren ones the hook is allowed to walk. */
const BARREN_LIMIT = 5

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

  it('walks past a page the studio narrowed away, rather than calling it the end', async () => {
    // The main process retypes the hits after the index answered, so a whole page can come back
    // empty with a cursor still live. The grid never asks again on an empty grid — so if the
    // hook stopped here, the tab would die on "nothing published" with pages still to come.
    install([
      { assets: [], cursor: 'o:40' },
      { assets: [], cursor: 'o:80' },
      { assets: [cloudAsset('a')], cursor: null },
    ])

    const { result } = renderHook(() => useExplore('image'))

    await waitFor(() => expect(result.current.assets.map(asset => asset.id)).toEqual(['a']))
  })

  it('drops the answer to a request the reader left behind and came back past', async () => {
    // Leaving a tab and returning makes two requests for the SAME source: told apart by name
    // alone, the first was accepted into the second's freshly reset feed — merging a page from
    // deep in the feed, overwriting the cursor, and marking a two-tile band exhausted for good.
    let answerDeep = (_page: CloudPage): void => {}
    const deep = new Promise<CloudPage>(resolve => {
      answerDeep = resolve
    })
    const explore = vi
      .fn<() => Promise<CloudPage>>()
      .mockReturnValueOnce(deep)
      .mockResolvedValue({ assets: [cloudAsset('fresh')], cursor: 'o:40' })
    installFakeBridge({ cloud: { explore } })

    const { result, rerender } = renderHook(({ type }: { type: AssetType }) => useExplore(type), {
      initialProps: { type: 'image' },
    })

    rerender({ type: 'video' })
    rerender({ type: 'image' })
    await waitFor(() => expect(result.current.assets.map(asset => asset.id)).toEqual(['fresh']))

    await act(async () => {
      answerDeep({ assets: [cloudAsset('stale')], cursor: null })
      await new Promise(settled => setTimeout(settled, 0))
    })

    expect(result.current.assets.map(asset => asset.id)).toEqual(['fresh'])
    expect(result.current.exhausted).toBe(false)
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
  })

  it('stops when the cursor comes back unchanged, instead of stopping for good in silence', async () => {
    // The symmetric failure to the runaway below: same cursor, every asset already held. Nothing
    // in `more`'s dependencies moves, so the effect never fires again — the tab freezes with
    // whatever it had and no way to ask for the rest. Better to say so than to hang.
    const { explore } = install([
      { assets: [cloudAsset('a')], cursor: 'o:40' },
      { assets: [cloudAsset('a')], cursor: 'o:40' },
    ])

    const { result } = renderHook(() => useExplore('image'))
    await waitFor(() => expect(result.current.assets).toHaveLength(1))

    act(() => result.current.more())
    await waitFor(() => expect(result.current.exhausted).toBe(true))

    expect(result.current.assets.map(asset => asset.id)).toEqual(['a'])
    expect(explore).toHaveBeenCalledTimes(2)
  })

  it('gives up on a feed that keeps handing back what it already showed', async () => {
    // At the foot of the feed the grid stays near its end and `more` takes a new identity with
    // every cursor: pages of pure duplicates fired thirty requests without a gesture. Offset
    // paging over a feed with deletions produces exactly that.
    let offset = 40
    const explore = vi.fn(() => {
      offset += 40
      return Promise.resolve({ assets: [cloudAsset('a')], cursor: `o:${offset}` })
    })
    installFakeBridge({ cloud: { explore } })

    const { result } = renderHook(() => useExplore('image'))
    await waitFor(() => expect(result.current.assets).toHaveLength(1))

    // What the grid does at the foot of the feed: `nearEnd` stays true, and every cursor gives
    // `more` a new identity, so the effect fires again on each page that lands.
    for (let asked = 0; asked < 30 && !result.current.exhausted; asked += 1) {
      await act(async () => {
        result.current.more()
        await new Promise(settled => setTimeout(settled, 0))
      })
    }

    expect(result.current.exhausted).toBe(true)
    // The number that matters is that it is bounded at all: thirty was the measured runaway.
    expect(explore.mock.calls.length).toBeLessThanOrEqual(BARREN_LIMIT)
  })

  it('counts only the pages in a row, so a lull does not end a live feed', async () => {
    // The feed shifts under the offset, so a page of pure duplicates now and then is ordinary.
    install([
      { assets: [cloudAsset('a')], cursor: 'o:40' },
      { assets: [cloudAsset('a')], cursor: 'o:80' },
      { assets: [cloudAsset('b')], cursor: 'o:120' },
      { assets: [cloudAsset('c')], cursor: null },
    ])

    const { result } = renderHook(() => useExplore('image'))
    await waitFor(() => expect(result.current.assets).toHaveLength(1))

    act(() => result.current.more())
    await waitFor(() => expect(result.current.assets).toHaveLength(1))
    act(() => result.current.more())
    await waitFor(() => expect(result.current.assets.map(asset => asset.id)).toEqual(['a', 'b']))

    expect(result.current.exhausted).toBe(false)
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
    })
    await waitFor(() => expect(result.current.assets.map(asset => asset.id)).toEqual(['a']))

    rerender({ type: 'video' })
    await waitFor(() => expect(result.current.assets.map(asset => asset.id)).toEqual(['b']))
    rerender({ type: 'image' })

    expect(result.current.assets.map(asset => asset.id)).toEqual(['a'])
    expect(explore).toHaveBeenCalledTimes(2)
  })

  it('forgets what it read under another key', async () => {
    const { explore } = install([
      { assets: [cloudAsset('a')], cursor: 'o:40' },
      { assets: [cloudAsset('b')], cursor: 'o:40' },
    ])

    const { result } = renderHook(() => useExplore('image'))
    await waitFor(() => expect(result.current.assets.map(asset => asset.id)).toEqual(['a']))

    act(() => useSettings.setState({ auth: { authenticated: true, ownerId: 'team_2' } }))
    await waitFor(() => expect(result.current.assets.map(asset => asset.id)).toEqual(['b']))

    act(() => useSettings.setState({ auth: { authenticated: true, ownerId: 'team_1' } }))
    // Read again rather than served from what the other key had on screen.
    expect(result.current.assets).toHaveLength(0)
    await waitFor(() => expect(explore).toHaveBeenCalledTimes(3))
  })

  it('does not call the feed empty before it has run out', async () => {
    // `exhausted` is the only thing allowed to mean "nothing published": before it, the first
    // round trip has not even come back.
    install([{ assets: [], cursor: null }])

    const { result } = renderHook(() => useExplore('image'))
    expect(result.current.exhausted).toBe(false)

    await waitFor(() => expect(result.current.exhausted).toBe(true))
  })
})

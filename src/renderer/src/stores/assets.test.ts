import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ASSET_SEARCH_LIMIT_MAX, type Asset, type AssetQuery } from '@shared/domain/asset'
import { installFakeBridge } from '@/services/fakeBridge'
import { assetsById, assetVersionOf, forgetRememberedAssets, useAssets } from './assets'

function asset(id: string, name: string): Asset {
  return { id, name, type: 'image', location: 'local', tags: [], createdAt: '2026-08-07' }
}

describe('assetsById', () => {
  beforeEach(() => {
    // This project runs without `testSetup`, which is where the renderer's cases get it.
    forgetRememberedAssets()
    useAssets.setState({ items: [] })
  })

  it('keys the catalogue by id', () => {
    useAssets.setState({ items: [asset('a', 'One'), asset('b', 'Two')] })

    expect(assetsById(useAssets.getState()).get('b')?.name).toBe('Two')
  })

  /**
   * The whole point of deriving it here: zustand compares what a selector returns, so a fresh
   * Map per call would re-render every subscriber on every notification of any store field.
   */
  it('hands back the same map while the catalogue has not changed', () => {
    useAssets.setState({ items: [asset('a', 'One')] })

    expect(assetsById(useAssets.getState())).toBe(assetsById(useAssets.getState()))
  })

  // Derived rather than stored beside `items`, so no writer can leave it behind.
  it('re-indexes as soon as the catalogue is replaced', () => {
    useAssets.setState({ items: [asset('a', 'One')] })
    const before = assetsById(useAssets.getState())

    useAssets.setState({ items: [asset('a', 'Renamed')] })
    const after = assetsById(useAssets.getState())

    expect(after).not.toBe(before)
    expect(after.get('a')?.name).toBe('Renamed')
  })

  /**
   * The defect this closes: filtering the browser to meshes narrows the catalogue the store
   * holds, and a montage of video clips lost its names, its stills and the lengths a trim clamps
   * against — all three read through this index.
   */
  it('still answers for an asset the browsing scope has dropped', () => {
    useAssets.setState({ items: [asset('a', 'One')] })
    assetsById(useAssets.getState())

    useAssets.setState({ items: [asset('mesh', 'A mesh')] })
    const narrowed = assetsById(useAssets.getState())

    expect(narrowed.get('a')?.name).toBe('One')
    expect(narrowed.get('mesh')?.name).toBe('A mesh')
  })

  it('forgets what it remembered when the harness asks', () => {
    useAssets.setState({ items: [asset('a', 'One')] })
    assetsById(useAssets.getState())

    forgetRememberedAssets()
    useAssets.setState({ items: [] })

    expect(assetsById(useAssets.getState()).get('a')).toBeUndefined()
  })
})

/** The queries the catalogue was asked, in order — and its length is how many reads happened. */
function watchSearch(): readonly unknown[] {
  const asked: unknown[] = []
  installFakeBridge({
    assets: {
      search: query => {
        asked.push(query)
        return Promise.resolve([])
      },
    },
  })
  return asked
}

describe('the kinds the catalogue is asked for', () => {
  beforeEach(() => {
    useAssets.setState({ items: [], scope: null })
  })

  it('asks for the kinds the space uses, and nothing else', async () => {
    const asked = watchSearch()

    await useAssets.getState().setScope(['image'])

    expect(asked).toEqual([{ types: ['image'], limit: 200, offset: 0 }])
  })

  it('asks for everything once the scope is dropped', async () => {
    const asked = watchSearch()
    useAssets.setState({ scope: ['audio'] })

    await useAssets.getState().setScope(null)

    expect(asked).toEqual([{ limit: 200, offset: 0 }])
  })

  // The panel calls this on every render; without the guard it would re-read the catalogue in
  // a loop, and each read sets state that triggers the next render.
  it('does not read the catalogue again for a scope it already holds', async () => {
    const asked = watchSearch()

    await useAssets.getState().setScope(['image'])
    await useAssets.getState().setScope(['image'])

    expect(asked).toHaveLength(1)
  })

  it('tells two scopes apart by what they hold, not by identity', async () => {
    const asked = watchSearch()

    await useAssets.getState().setScope(['image'])
    await useAssets.getState().setScope(['image', 'skybox'])

    expect(asked).toHaveLength(2)
  })
})

/**
 * A catalogue of `total` rows, answering whichever page it is asked for — which is what the real
 * one does and what nothing on this side used to ask: `catalog.search` stops at 200 rows however
 * it is questioned, so a project of a thousand assets showed two hundred and said nothing.
 */
function catalogueOf(total: number): readonly AssetQuery[] {
  const asked: AssetQuery[] = []
  installFakeBridge({
    assets: {
      search: query => {
        asked.push(query)
        const offset = query.offset ?? 0
        const length = Math.max(0, Math.min(query.limit ?? total, total - offset))
        return Promise.resolve(
          Array.from({ length }, (_unused, index) => asset(`a${offset + index}`, 'Row')),
        )
      },
    },
  })
  return asked
}

describe('reading the catalogue a page at a time', () => {
  beforeEach(() => {
    forgetRememberedAssets()
    useAssets.setState({ items: [], scope: null, hasMore: false })
  })

  it('says the catalogue holds more when the page came back full', async () => {
    catalogueOf(500)

    await useAssets.getState().refresh()

    expect(useAssets.getState().items).toHaveLength(200)
    expect(useAssets.getState().hasMore).toBe(true)
  })

  it('says nothing more is coming when the page came back short', async () => {
    catalogueOf(120)

    await useAssets.getState().refresh()

    expect(useAssets.getState().hasMore).toBe(false)
  })

  it('appends the next page rather than replacing what is on screen', async () => {
    const asked = catalogueOf(500)
    await useAssets.getState().refresh()

    await useAssets.getState().loadMore()

    expect(useAssets.getState().items).toHaveLength(400)
    expect(asked[1]).toMatchObject({ offset: 200 })
  })

  // `onReachEnd` fires on every row that nears the end, and each page costs a query on the
  // process every window shares.
  it('asks once for a scroll that fires twice', async () => {
    const asked = catalogueOf(500)
    await useAssets.getState().refresh()
    const before = asked.length

    await Promise.all([useAssets.getState().loadMore(), useAssets.getState().loadMore()])

    expect(asked.length - before).toBe(1)
  })

  it('asks for nothing at the end of the catalogue', async () => {
    const asked = catalogueOf(120)
    await useAssets.getState().refresh()
    const before = asked.length

    await useAssets.getState().loadMore()

    expect(asked.length).toBe(before)
  })

  /**
   * What a refresh must not do: a generation finishing while the reader sits at row 300 would
   * otherwise cut the list back to 200 under them, and only another scroll would bring it back.
   */
  it('hands back as many pages as the shelf was holding', async () => {
    catalogueOf(500)
    await useAssets.getState().refresh()
    await useAssets.getState().loadMore()

    await useAssets.getState().refresh()

    expect(useAssets.getState().items).toHaveLength(400)
  })

  // `refresh` runs on every catalogue event, and each read is a synchronous SQLite query on the
  // process every window shares: a reader at row 400 paid two to learn one page had moved.
  it('re-reads a shelf of two pages in one query rather than two', async () => {
    const asked = catalogueOf(1200)
    // The page count lives in the store's closure, where no `setState` reaches it and where it
    // outlives a case. A change of space is the only seam from outside that puts it back to one.
    useAssets.getState().setScope(['image'])
    await useAssets.getState().refresh()
    await useAssets.getState().loadMore()
    const before = asked.length

    await useAssets.getState().refresh()

    expect(asked.length - before).toBe(1)
    expect(asked[before]).toMatchObject({ offset: 0, limit: 400 })
    expect(useAssets.getState().items).toHaveLength(400)
  })

  // The bound is the main process's, and it refuses rather than trims: past it the read has to
  // be cut, and cut as few times as the bound allows.
  it('cuts a shelf wider than one query at the bound the main process refuses past', async () => {
    const asked = catalogueOf(1200)
    useAssets.getState().setScope(['image'])
    await useAssets.getState().refresh()
    for (let page = 0; page < 4; page += 1) await useAssets.getState().loadMore()
    const before = asked.length

    await useAssets.getState().refresh()

    expect(asked.slice(before)).toMatchObject([
      { limit: ASSET_SEARCH_LIMIT_MAX, offset: 0 },
      { limit: ASSET_SEARCH_LIMIT_MAX, offset: ASSET_SEARCH_LIMIT_MAX },
    ])
    expect(useAssets.getState().items).toHaveLength(1000)
    expect(useAssets.getState().hasMore).toBe(true)
  })

  // 200 rows for a read that asked 400. Read as full against `LOCAL_PAGE`, the shelf believes a
  // page more is waiting and spends a SECOND query to find nothing — which is what is counted
  // here: the end state alone is the same either way, only the cost differs.
  it('says nothing more is coming when a wide read came back short', async () => {
    catalogueOf(1200)
    useAssets.getState().setScope(['image'])
    await useAssets.getState().refresh()
    await useAssets.getState().loadMore()

    // The catalogue shrank between two events — a selection removed while the reader sat there.
    const asked = catalogueOf(200)
    await useAssets.getState().refresh()

    expect(asked).toHaveLength(1)
    expect(useAssets.getState().items).toHaveLength(200)
    expect(useAssets.getState().hasMore).toBe(false)
  })

  /**
   * Without the floor under the page count, an empty catalogue leaves it at zero, the loop stops
   * running at all, and the shelf never fills again — not on an import, not on a generation.
   */
  it('still reads the catalogue after finding it empty', async () => {
    catalogueOf(0)
    useAssets.getState().setScope(['image'])
    await useAssets.getState().refresh()
    expect(useAssets.getState().items).toEqual([])

    catalogueOf(30)
    await useAssets.getState().refresh()

    expect(useAssets.getState().items).toHaveLength(30)
  })

  it('starts again at one page when the space changes', async () => {
    catalogueOf(500)
    await useAssets.getState().refresh()
    await useAssets.getState().loadMore()

    useAssets.getState().setScope(['mesh'])
    // The read `setScope` started, shared rather than opened a second time.
    await useAssets.getState().refresh()

    expect(useAssets.getState().items).toHaveLength(200)
  })
})

/**
 * The write nothing else says out loud: a model sheds its pictures on the main process, seconds
 * after the import that produced it was answered and its shelf refreshed. Without this the
 * inspector said « no picture was taken out of this model » until the model was picked again.
 */
describe('what the main process writes on its own', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useAssets.setState({ items: [], scope: null })
  })
  afterEach(() => vi.useRealTimers())

  it('re-reads the catalogue when the main process says it wrote', async () => {
    let announce = (_changed: readonly Asset[]): void => {}
    const asked: unknown[] = []
    installFakeBridge({
      assets: {
        search: query => {
          asked.push(query)
          return Promise.resolve([])
        },
        onChanged: callback => {
          announce = callback
          return () => {}
        },
      },
    })

    const stop = await useAssets.getState().connect()
    announce([])
    vi.runAllTimers()

    expect(asked).toHaveLength(1)
    stop()
  })

  /**
   * The ceiling this lifts: `items` is one page of the newest rows, so an asset older than that
   * page kept the stamp it was last SEEN with — and every texture slot pointing at it compared
   * equal for ever. The read that follows is a third of a second away; a slot may ask before it.
   */
  it('carries a rewritten row before the shelf has read anything back', async () => {
    let announce = (_changed: readonly Asset[]): void => {}
    installFakeBridge({
      assets: {
        search: () => Promise.resolve([]),
        onChanged: callback => {
          announce = callback
          return () => {}
        },
      },
    })

    const stop = await useAssets.getState().connect()
    announce([{ ...asset('old', 'Older than the page'), localChangedAt: 'written-again' }])

    expect(assetVersionOf('old')).toBe('written-again')
    stop()
  })

  it('stops listening when the window lets go', async () => {
    let listening = true
    installFakeBridge({
      assets: {
        onChanged: () => () => {
          listening = false
        },
      },
    })

    const stop = await useAssets.getState().connect()
    stop()

    expect(listening).toBe(false)
  })
})

/**
 * The timer `invalidate` arms lives at MODULE scope, so it outlives the case that armed it. Left
 * alone it fires inside a LATER case and re-reads the catalogue through whatever bridge that one
 * installed — which is how a shelf changes under an element a test is already holding.
 */
describe('the coalesced read, and cancelling it', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('reads the catalogue once for a burst of invalidations', () => {
    const asked = watchSearch()

    useAssets.getState().invalidate()
    useAssets.getState().invalidate()
    useAssets.getState().invalidate()
    vi.runAllTimers()

    expect(asked).toHaveLength(1)
  })

  it('reads nothing more once the pending one is cancelled', () => {
    const asked = watchSearch()

    useAssets.getState().invalidate()
    useAssets.getState().cancelInvalidate()
    vi.runAllTimers()

    expect(asked).toHaveLength(0)
  })

  it('leaves no timer behind, which is what the harness relies on', () => {
    watchSearch()

    useAssets.getState().invalidate()
    useAssets.getState().cancelInvalidate()

    expect(vi.getTimerCount()).toBe(0)
  })
})

/**
 * Local on purpose: the name on the Scenario account is not touched. One asset is pulled into
 * several projects and named for what each one does with it.
 */
describe('renaming an asset', () => {
  beforeEach(() => {
    forgetRememberedAssets()
    useAssets.setState({ items: [asset('a', 'ElevenLabs Sound Effects 2')] })
  })

  /**
   * Straight into `items` rather than through `invalidate`: `assets:update` broadcasts nothing,
   * so the shelf is written where the write was ordered — and the tile shows the new name on the
   * next paint instead of a third of a second later.
   */
  it('writes the new name into the shelf, without waiting for a re-read', async () => {
    const update = vi.fn(() => Promise.resolve(asset('a', 'Pas courus')))
    installFakeBridge({ assets: { update } })

    expect(await useAssets.getState().rename('a', 'Pas courus')).toBeNull()

    expect(update).toHaveBeenCalledWith('a', { name: 'Pas courus' })
    expect(assetsById(useAssets.getState()).get('a')?.name).toBe('Pas courus')
  })

  it('refuses a name nobody typed, without troubling the catalogue', async () => {
    const update = vi.fn()
    installFakeBridge({ assets: { update } })

    expect(await useAssets.getState().rename('a', '   ')).toBe('empty')
    expect(update).not.toHaveBeenCalled()
  })

  // The catalogue is what decides; a window that believed otherwise keeps the name it had.
  it('keeps the old name when the catalogue refused', async () => {
    installFakeBridge({ assets: { update: () => Promise.reject(new Error('no')) } })

    await useAssets.getState().rename('a', 'Pas courus')

    expect(assetsById(useAssets.getState()).get('a')?.name).toBe('ElevenLabs Sound Effects 2')
  })
})

/**
 * Told apart from a rename by what a type DECIDES: the shelf reads a scope, and a picture that
 * has just become a texture is no longer a row the Image space asked for.
 */
describe('correcting what an asset is', () => {
  const retyped = (): Asset => ({ ...asset('a', 'Ruelle'), type: 'skybox' })

  beforeEach(() => {
    forgetRememberedAssets()
    useAssets.setState({ items: [asset('a', 'Ruelle'), asset('b', 'Toit')] })
  })

  it('takes the row off a shelf that no longer asks for it', async () => {
    useAssets.setState({ scope: ['image'] })
    installFakeBridge({ assets: { update: () => Promise.resolve(retyped()) } })

    await useAssets.getState().retype('a', 'skybox')

    expect(useAssets.getState().items.map(item => item.id)).toEqual(['b'])
  })

  it('keeps it where the shelf asks for every kind', async () => {
    useAssets.setState({ scope: null })
    installFakeBridge({ assets: { update: () => Promise.resolve(retyped()) } })

    await useAssets.getState().retype('a', 'skybox')

    expect(assetsById(useAssets.getState()).get('a')?.type).toBe('skybox')
  })
})

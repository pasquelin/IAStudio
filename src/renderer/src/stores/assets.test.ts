import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import { installFakeBridge } from '@/services/fakeBridge'
import { assetsById, forgetRememberedAssets, useAssets } from './assets'

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

    await useAssets.getState().setScope(['image', 'texture'])

    expect(asked).toEqual([{ types: ['image', 'texture'] }])
  })

  it('asks for everything once the scope is dropped', async () => {
    const asked = watchSearch()
    useAssets.setState({ scope: ['audio'] })

    await useAssets.getState().setScope(null)

    expect(asked).toEqual([{}])
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

    await useAssets.getState().setScope(['image', 'texture'])
    await useAssets.getState().setScope(['image', 'skybox'])

    expect(asked).toHaveLength(2)
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
    let announce = (): void => {}
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
    announce()
    vi.runAllTimers()

    expect(asked).toHaveLength(1)
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
  const retyped = (): Asset => ({ ...asset('a', 'Ruelle'), type: 'texture' })

  beforeEach(() => {
    forgetRememberedAssets()
    useAssets.setState({ items: [asset('a', 'Ruelle'), asset('b', 'Toit')] })
  })

  it('takes the row off a shelf that no longer asks for it', async () => {
    useAssets.setState({ scope: ['image'] })
    installFakeBridge({ assets: { update: () => Promise.resolve(retyped()) } })

    await useAssets.getState().retype('a', 'texture')

    expect(useAssets.getState().items.map(item => item.id)).toEqual(['b'])
  })

  it('keeps it where the shelf asks for every kind', async () => {
    useAssets.setState({ scope: null })
    installFakeBridge({ assets: { update: () => Promise.resolve(retyped()) } })

    await useAssets.getState().retype('a', 'texture')

    expect(assetsById(useAssets.getState()).get('a')?.type).toBe('texture')
  })
})

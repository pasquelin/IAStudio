import { beforeEach, describe, expect, it } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import { installFakeBridge } from '@/services/fake-bridge'
import { assetsById, useAssets } from './assets'

function asset(id: string, name: string): Asset {
  return { id, name, type: 'image', location: 'local', tags: [], createdAt: '2026-08-07' }
}

describe('assetsById', () => {
  beforeEach(() => {
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
})

describe('the kinds the catalogue is asked for', () => {
  beforeEach(() => {
    useAssets.setState({ items: [], scope: null })
  })

  it('asks for the kinds the space uses, and nothing else', async () => {
    const asked: unknown[] = []
    installFakeBridge({
      assets: {
        search: query => {
          asked.push(query)
          return Promise.resolve([])
        },
      },
    })

    await useAssets.getState().setScope(['image', 'texture'])

    expect(asked).toEqual([{ types: ['image', 'texture'] }])
  })

  it('asks for everything once the scope is dropped', async () => {
    const asked: unknown[] = []
    installFakeBridge({
      assets: {
        search: query => {
          asked.push(query)
          return Promise.resolve([])
        },
      },
    })
    useAssets.setState({ scope: ['audio'] })

    await useAssets.getState().setScope(null)

    expect(asked).toEqual([{}])
  })

  // The panel calls this on every render; without the guard it would re-read the catalogue in
  // a loop, and each read sets state that triggers the next render.
  it('does not read the catalogue again for a scope it already holds', async () => {
    let reads = 0
    installFakeBridge({
      assets: {
        search: () => {
          reads += 1
          return Promise.resolve([])
        },
      },
    })

    await useAssets.getState().setScope(['image'])
    await useAssets.getState().setScope(['image'])

    expect(reads).toBe(1)
  })

  it('tells two scopes apart by what they hold, not by identity', async () => {
    let reads = 0
    installFakeBridge({
      assets: {
        search: () => {
          reads += 1
          return Promise.resolve([])
        },
      },
    })

    await useAssets.getState().setScope(['image', 'texture'])
    await useAssets.getState().setScope(['image', 'skybox'])

    expect(reads).toBe(2)
  })
})

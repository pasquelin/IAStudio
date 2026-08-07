import { beforeEach, describe, expect, it } from 'vitest'
import type { Asset } from '@shared/domain/asset'
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

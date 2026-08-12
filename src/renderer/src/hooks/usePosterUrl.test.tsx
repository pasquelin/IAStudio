import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { assetUrl, type Asset } from '@shared/domain/asset'
import { useAssets } from '@/stores/assets'
import { usePosterUrl } from './usePosterUrl'

const asset = (overrides: Partial<Asset> = {}): Asset => ({
  id: 'asset-1',
  name: 'shot.png',
  type: 'image',
  location: 'local',
  tags: [],
  createdAt: '2026-08-07T10:00:00.000Z',
  ...overrides,
})

const shelf = (items: readonly Asset[]): void => {
  useAssets.setState({ items })
}

afterEach(() => shelf([]))

describe('usePosterUrl', () => {
  it('answers nothing for a slot holding no asset', () => {
    expect(renderHook(() => usePosterUrl(null)).result.current).toBeUndefined()
    expect(renderHook(() => usePosterUrl(undefined)).result.current).toBeUndefined()
  })

  /**
   * The whole reason this exists: a slot names an asset by id, and an id is a stable URL — so a
   * ⌘S that overwrote the file would leave the browser serving the bitmap it already decoded.
   */
  it('stamps the URL with the moment the file last changed', () => {
    shelf([asset({ localChangedAt: '2026-08-12T09:00:00.000Z' })])

    expect(renderHook(() => usePosterUrl('asset-1')).result.current).not.toBe(assetUrl('asset-1'))
  })

  /**
   * The shelf is scoped by type, so a channel can perfectly well name an asset this store is not
   * holding. Falling back to the icon there would be a picture lost to buy a stamp.
   */
  it('falls back to the plain URL for an id the catalogue does not hold', () => {
    expect(renderHook(() => usePosterUrl('asset-9')).result.current).toBe(assetUrl('asset-9'))
  })

  // A cloud row has no file to serve yet; the URL it had before is the one it keeps.
  it('falls back to the plain URL for an asset that has no poster', () => {
    shelf([asset({ location: 'cloud' })])

    expect(renderHook(() => usePosterUrl('asset-1')).result.current).toBe(assetUrl('asset-1'))
  })
})

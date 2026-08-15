import { beforeEach, describe, expect, it } from 'vitest'
import type { Asset, AssetType } from '@shared/domain/asset'
import { installFakeBridge } from '@/services/fake-bridge'
import { useAssets } from '@/stores/assets'
import { useCloud } from '@/stores/cloud'
import {
  ASSET_DRAG_TYPE,
  assetIdFromDrag,
  carriesAsset,
  draggedAssetType,
  droppedAsset,
  startAssetDrag,
  startLibraryDrag,
} from './asset-drag'
import { dragTransfer as transfer } from './drag-fixtures'

describe('asset drag', () => {
  it('carries the asset id under a private type', () => {
    const dataTransfer = transfer()
    startAssetDrag({ dataTransfer }, { id: 'asset-1', type: 'image' })
    expect(dataTransfer.getData(ASSET_DRAG_TYPE)).toBe('asset-1')
  })

  it('reads the id back', () => {
    const dataTransfer = transfer()
    startAssetDrag({ dataTransfer }, { id: 'asset-1', type: 'image' })
    expect(assetIdFromDrag({ dataTransfer })).toBe('asset-1')
  })

  it('reads nothing from a drag that carries something else', () => {
    expect(assetIdFromDrag({ dataTransfer: transfer() })).toBeNull()
  })

  it('survives a drag with no data transfer at all', () => {
    expect(() =>
      startAssetDrag({ dataTransfer: null }, { id: 'asset-1', type: 'image' }),
    ).not.toThrow()
    expect(assetIdFromDrag({ dataTransfer: null })).toBeNull()
  })

  // The platform answers nothing from `getData` during a drag, so a target that must decide
  // whether it would accept the drop can only read `types` — hence the kind in the MIME.
  it('says which kind is flying, before the drop', () => {
    const dataTransfer = transfer()
    startAssetDrag({ dataTransfer }, { id: 'asset-1', type: 'skybox' })

    expect(draggedAssetType({ dataTransfer })).toBe('skybox')
    expect(carriesAsset({ dataTransfer })).toBe(true)
  })

  it('announces every kind under its own type', () => {
    const kinds: AssetType[] = ['image', 'video', 'audio', 'mesh', 'texture', 'skybox']

    for (const type of kinds) {
      const dataTransfer = transfer()
      startAssetDrag({ dataTransfer }, { id: 'asset-1', type })
      expect(draggedAssetType({ dataTransfer })).toBe(type)
    }
  })

  it('reads no kind from a drag that is not ours', () => {
    expect(draggedAssetType({ dataTransfer: transfer() })).toBeNull()
    expect(carriesAsset({ dataTransfer: null })).toBe(false)
  })
})

describe('what a drop resolves to', () => {
  const row: Asset = {
    id: 'asset_local',
    name: 'moss.png',
    type: 'image',
    location: 'local',
    tags: [],
    createdAt: '2026-08-07T10:00:00.000Z',
  }

  beforeEach(() => {
    useCloud.getState().clear()
    useAssets.setState({ items: [] })
  })

  it('hands over a catalogue row without asking the network', async () => {
    installFakeBridge({})
    useAssets.setState({ items: [row] })
    const dataTransfer = transfer()
    startAssetDrag({ dataTransfer }, { id: 'asset_local', type: 'image' })

    expect(await droppedAsset({ dataTransfer })).toMatchObject({ id: 'asset_local' })
  })

  /**
   * The whole point of the library drag: a target accepts the same kinds and lands the same
   * `Asset`, and the only difference is that the bytes come down first. Refusing it instead
   * would have made half the browser a shelf one can only look at.
   */
  it('fetches a library asset first, then hands over the row it became', async () => {
    let pulled: readonly string[] = []
    installFakeBridge({
      cloud: {
        pull: ids => {
          pulled = ids
          useAssets.setState({ items: [{ ...row, remoteAssetId: 'asset_remote' }] })
          return Promise.resolve([{ assetId: 'asset_remote', ok: true }])
        },
      },
      assets: { search: () => Promise.resolve([{ ...row, remoteAssetId: 'asset_remote' }]) },
    })

    const dataTransfer = transfer()
    startLibraryDrag({ dataTransfer }, { id: 'asset_remote', type: 'image' })

    expect(await droppedAsset({ dataTransfer })).toMatchObject({ id: 'asset_local' })
    expect(pulled).toEqual(['asset_remote'])
  })

  // An id the catalogue does not hold and no library marker: nothing to fetch and nothing to
  // hand over. Downloading on the strength of a stale id would spend a transfer on a guess.
  it('never fetches for a drag that did not come from the library', async () => {
    let pulls = 0
    installFakeBridge({
      cloud: {
        pull: () => {
          pulls += 1
          return Promise.resolve([])
        },
      },
    })
    const dataTransfer = transfer()
    startAssetDrag({ dataTransfer }, { id: 'asset_gone', type: 'image' })

    expect(await droppedAsset({ dataTransfer })).toBeNull()
    expect(pulls).toBe(0)
  })

  // Dropping does not take the asset away from the shelf it came from, and the platform draws
  // the pointer from this: `move` shows the arrow that means "this leaves where it is".
  it('announces itself as a copy, so the pointer offers to add', () => {
    const dataTransfer = transfer()
    startAssetDrag({ dataTransfer }, { id: 'asset_local', type: 'image' })

    expect(dataTransfer.effectAllowed).toBe('copy')
  })
})

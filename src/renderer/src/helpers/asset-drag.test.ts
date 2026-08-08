import { describe, expect, it } from 'vitest'
import type { AssetType } from '@shared/domain/asset'
import {
  ASSET_DRAG_TYPE,
  assetIdFromDrag,
  carriesAsset,
  draggedAssetType,
  startAssetDrag,
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

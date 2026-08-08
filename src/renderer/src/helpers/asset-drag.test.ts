import { describe, expect, it } from 'vitest'
import { ASSET_DRAG_TYPE, assetIdFromDrag, startAssetDrag } from './asset-drag'
import { dragTransfer as transfer } from './drag-fixtures'

describe('asset drag', () => {
  it('carries the asset id under a private type', () => {
    const dataTransfer = transfer()
    startAssetDrag({ dataTransfer }, 'asset-1')
    expect(dataTransfer.getData(ASSET_DRAG_TYPE)).toBe('asset-1')
  })

  it('reads the id back', () => {
    const dataTransfer = transfer()
    startAssetDrag({ dataTransfer }, 'asset-1')
    expect(assetIdFromDrag({ dataTransfer })).toBe('asset-1')
  })

  it('reads nothing from a drag that carries something else', () => {
    expect(assetIdFromDrag({ dataTransfer: transfer() })).toBeNull()
  })

  it('survives a drag with no data transfer at all', () => {
    expect(() => startAssetDrag({ dataTransfer: null }, 'asset-1')).not.toThrow()
    expect(assetIdFromDrag({ dataTransfer: null })).toBeNull()
  })
})

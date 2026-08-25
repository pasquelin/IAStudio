import { beforeEach, describe, expect, it, vi } from 'vitest'
import { assetVersionOf } from './assets'
import { livePreviewOf, useLivePreviews } from './livePreviews'

const bitmap = (): ImageBitmap => {
  const close = vi.fn()
  return { width: 1, height: 1, close } as unknown as ImageBitmap
}

describe('what an open editor is showing of an asset', () => {
  beforeEach(() => {
    useLivePreviews.setState({ previews: new Map() })
  })

  it('answers nothing while no editor has published', () => {
    expect(livePreviewOf('asset-1')).toBeNull()
  })

  /**
   * An `ImageBitmap` holds pixels the collector is in no hurry to free, and a stroke publishes
   * once a gesture: left open, a minute of drawing keeps a canvas per publish.
   */
  it('frees the picture it replaces', () => {
    const first = bitmap()
    useLivePreviews.getState().publishPreview('asset-1', first)
    useLivePreviews.getState().publishPreview('asset-1', bitmap())

    expect(first.close).toHaveBeenCalled()
  })

  // A preview is a state of the WINDOW: the tab that published it going away gives the asset
  // back to its file, and nothing in the studio may come to depend on one.
  it('gives the asset back to its file when revoked', () => {
    const shown = bitmap()
    useLivePreviews.getState().publishPreview('asset-1', shown)
    useLivePreviews.getState().revokePreview('asset-1')

    expect(livePreviewOf('asset-1')).toBeNull()
    expect(shown.close).toHaveBeenCalled()
  })

  /**
   * The version is what a texture slot compares to know it must load again — a preview that did
   * not move it would be published into a cache already holding the file under the same key.
   */
  it('moves the version a slot compares, and puts it back on revoking', () => {
    const before = assetVersionOf('asset-1')

    useLivePreviews.getState().publishPreview('asset-1', bitmap())
    const shown = assetVersionOf('asset-1')
    useLivePreviews.getState().publishPreview('asset-1', bitmap())

    expect(shown).not.toBe(before)
    expect(assetVersionOf('asset-1')).not.toBe(shown)

    useLivePreviews.getState().revokePreview('asset-1')
    expect(assetVersionOf('asset-1')).toBe(before)
  })
})

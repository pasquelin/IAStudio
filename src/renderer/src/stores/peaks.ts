import { create } from 'zustand'
import { getBridge } from '@/services/bridge'

type PeaksState = {
  /** Absent means never asked; null means asked and there is nothing to draw. */
  byAsset: Record<string, Float32Array | null>
  /** Fetches an asset's waveform once. Safe to call again for one already asked for. */
  request: (assetId: string) => void
}

/**
 * Waveforms, fetched once per asset and kept for the session. They come from the file written
 * at ingest, never recomputed here: decoding a three-minute take to draw a rectangle is the
 * kind of work that turns a scroll into a slideshow.
 */
export const usePeaks = create<PeaksState>()((set, get) => {
  // Outside the state: an in-flight request is not something anything renders, and putting it
  // in the store would re-run every selector twice per asset.
  const pending = new Set<string>()

  return {
    byAsset: {},

    request: assetId => {
      if (pending.has(assetId) || assetId in get().byAsset) return

      const bridge = getBridge()
      if (!bridge) return

      pending.add(assetId)
      void bridge.assets
        .peaks(assetId)
        .catch(() => null)
        .then(peaks => {
          pending.delete(assetId)
          set(state => ({ byAsset: { ...state.byAsset, [assetId]: peaks } }))
        })
    },
  }
})

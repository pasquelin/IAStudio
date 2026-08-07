import { create } from 'zustand'
import { getBridge } from '@/services/bridge'

type PeaksState = {
  /** Absent means never asked; null means asked and there is nothing to draw. */
  byAsset: Record<string, Float32Array | null>
  /** Fetches an asset's waveform once. Safe to call on every paint. */
  request: (assetId: string) => void
  clear: () => void
}

export function peaksOf(state: Pick<PeaksState, 'byAsset'>, assetId: string): Float32Array | null {
  return state.byAsset[assetId] ?? null
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

    clear: () => {
      pending.clear()
      set({ byAsset: {} })
    },
  }
})

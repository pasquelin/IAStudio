import { create } from 'zustand'
import { PEAKS_PER_SECOND } from '@shared/domain/asset'
import { peaksFromSamples } from '@/engines/audio/audioData'
import { decodeAsset } from '@/helpers/audio-decode'
import { getBridge } from '@/services/bridge'

type ByAsset = Record<string, Float32Array | null>

type PeaksState = {
  /** Absent means never asked; null means asked and there is nothing to draw. */
  byAsset: ByAsset
  /** Fetches an asset's waveform once. Safe to call again for one already asked for. */
  request: (assetId: string) => void
}

/**
 * How much waveform to keep.
 *
 * A three-minute take is 9 000 pairs, or 72 kB — small enough that nothing bounded it, and a
 * session that keeps every one it ever drew has no ceiling at all. Thirty-two megabytes holds
 * some four hundred takes of that length, well past what a montage puts on screen, so the
 * oldest is only ever dropped by a project no timeline could show at once.
 */
const BUDGET_BYTES = 32 * 1024 * 1024

/**
 * The table with its oldest arrivals dropped until it fits.
 *
 * By arrival rather than by last use: a waveform is "used" on every paint of every visible
 * clip, and touching the store there would notify its subscribers sixty times a second. The
 * budget is set high enough that the two orders cannot differ for any real montage.
 */
function withinBudget(byAsset: ByAsset): ByAsset {
  let held = 0
  for (const peaks of Object.values(byAsset)) held += peaks?.byteLength ?? 0
  if (held <= BUDGET_BYTES) return byAsset

  const kept = { ...byAsset }
  // String keys keep their insertion order, so the oldest arrival is the first one seen.
  for (const [assetId, peaks] of Object.entries(kept)) {
    if (held <= BUDGET_BYTES) break
    held -= peaks?.byteLength ?? 0
    delete kept[assetId]
  }
  return kept
}

/**
 * The waveform of a take the ingest never derived one for, read from the file itself.
 *
 * A FALLBACK, and only that: the ingest writes these at import, and decoding a three-minute take
 * to draw a rectangle is the kind of work that turns a scroll into a slideshow. But an asset
 * that came down from the API before ffmpeg was reachable — or a machine whose ffmpeg does not
 * start, which is how this was found — has no file to read, and a montage of clips that draw
 * nothing while the editor above them draws a full waveform is the studio contradicting itself.
 *
 * Once per asset, cached like any other: the cost is paid on the first paint that needs it.
 */
async function derivePeaks(assetId: string): Promise<Float32Array | null> {
  try {
    return peaksFromSamples(await decodeAsset(assetId), PEAKS_PER_SECOND)
  } catch {
    // An asset that is not sound at all reaches here too — every clip asks, and a picture has no
    // waveform to fail at deriving.
    return null
  }
}

/**
 * Waveforms, fetched once per asset and kept for the session. They come from the file written
 * at ingest, and are derived from the take itself only when that file is missing.
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
        .then(peaks => peaks ?? derivePeaks(assetId))
        .then(peaks => {
          pending.delete(assetId)
          set(state => ({ byAsset: withinBudget({ ...state.byAsset, [assetId]: peaks }) }))
        })
    },
  }
})

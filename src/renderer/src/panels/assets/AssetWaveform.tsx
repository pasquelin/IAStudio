import { useEffect } from 'react'
import { Waveform } from '@/design/Waveform'
import { usePeaks } from '@/stores/peaks'

export type AssetWaveformProps = {
  assetId: string
}

/**
 * What a sound shows on a tile: its own shape, in place of the speaker glyph every sound of the
 * shelf used to wear — two takes of the same length were indistinguishable until one was played.
 *
 * The waveform is the one the montage draws from, asked for here and answered on a later frame:
 * the ingest writes it at import, and a take it never derived one for is decoded once and kept
 * (`usePeaks`). Until then the tile is empty rather than showing a glyph that would then vanish.
 *
 * Subscribed per tile rather than by the shelf: the table gains one asset at a time, and a
 * selector over the whole of it re-renders every cell each time a waveform lands.
 */
export function AssetWaveform({ assetId }: AssetWaveformProps) {
  const peaks = usePeaks(state => state.byAsset[assetId] ?? null)

  // In an effect and not while rendering: `request` writes to the store as soon as the fetch
  // settles, and a store written during a render is React's oldest way of tearing a tree.
  useEffect(() => {
    usePeaks.getState().request(assetId)
  }, [assetId])

  return <Waveform peaks={peaks} />
}

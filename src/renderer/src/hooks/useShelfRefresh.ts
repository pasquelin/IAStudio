import { useEffect, useRef } from 'react'
import { useAssets } from '@/stores/assets'

/**
 * Tells an engine to ask again for the pictures it holds, every time the shelf is re-read.
 *
 * The id a texture slot points at does not move when ⌘S rewrites the file behind it, so nothing
 * inside an engine can see that an edit happened — this is the push that makes « edit the picture
 * and the model follows » work, in the three spaces that show one.
 *
 * Costs nothing when no version moved: every binding compares what it holds before letting go.
 *
 * The callback is held in a ref so the catalogue is the ONLY thing that fires it: read as a
 * dependency, a fresh arrow at the call site — which is what every caller writes — would refresh
 * on each render of its component instead.
 */
export function useShelfRefresh(refresh: () => void): void {
  const items = useAssets(state => state.items)
  const latest = useRef(refresh)

  useEffect(() => {
    latest.current = refresh
  })

  useEffect(() => {
    latest.current()
  }, [items])
}

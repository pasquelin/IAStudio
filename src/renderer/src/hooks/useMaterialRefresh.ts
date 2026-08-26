import { useEffect } from 'react'
import { useMaterials } from '@/stores/materials'
import { useMaterialSources } from '@/stores/materialSources'
import { useLatest } from './useLatest'

/**
 * Tells an engine to dress again the models wearing the material documents that just changed.
 *
 * Sibling of `useShelfRefresh`: a model names a material DOCUMENT, and swapping one of its
 * channels moves no asset id, so the shelf says nothing. WHICH documents, rather than « some »:
 * a redraw marks the shadows stale, and a scene of twenty models would pay for a slider dragged
 * in another tab.
 *
 * Subscribed rather than selected, for the reason `useShelfRefresh` gives at its own line.
 */
export function useMaterialRefresh(refresh: (materialIds: readonly string[]) => void): void {
  const latest = useLatest(refresh)

  useEffect(() => {
    const tabs = useMaterials.subscribe((state, before) => {
      if (state.states === before.states) return

      const changed = Object.keys(state.states).filter(id => state.states[id] !== before.states[id])
      // A document CLOSING is a change too, and its id is gone from the new states — the model
      // wearing it has to fall back on the file, so what left counts as much as what moved.
      const closed = Object.keys(before.states).filter(id => !(id in state.states))
      if (changed.length + closed.length > 0) latest.current([...changed, ...closed])
    })

    // And the copies read off DISK: closing a tab hands the model back to its file, and the read
    // that answers lands a beat later with nothing subscribed to it — the model stayed undressed.
    const files = useMaterialSources.subscribe((state, before) => {
      const landed = Object.keys(state.copies).filter(id => state.copies[id] !== before.copies[id])
      if (landed.length > 0) latest.current(landed)
    })

    return () => {
      tabs()
      files()
    }
  }, [latest])
}

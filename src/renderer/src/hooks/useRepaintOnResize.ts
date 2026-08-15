import { useEffect, type RefObject } from 'react'

/**
 * Repaints a canvas whenever its box changes.
 *
 * `AnimationCanvas` and `TimelineCanvas` carried the same seven lines. The other three observers
 * of the tree are NOT callers: `Masonry`, `Collection` and `Carousel` measure a box to lay
 * children out, which is a different answer to the same event.
 *
 * `paint` must be stable — a `useCallback` with no changing dependency. Rebuilding the observer
 * on every dragged pixel would tear it down and re-create it sixty times a second.
 */
export function useRepaintOnResize(ref: RefObject<HTMLCanvasElement | null>, paint: () => void) {
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return

    const observer = new ResizeObserver(paint)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [ref, paint])
}

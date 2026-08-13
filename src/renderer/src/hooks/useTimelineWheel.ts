import { useEffect, useRef, type RefObject } from 'react'
import { scrollBy, zoomAt, ZOOM_STEP } from '@/engines/timeline/viewport'
import type { Viewport } from '@/engines/timeline/timeline-geometry'

/**
 * The wheel over a time band: zoom under the pointer with a modifier, scroll otherwise.
 *
 * Written once because the animation band and the video timeline spelt it identically — the same
 * gesture over the same kind of surface, and a fix to one of them left the other behind.
 *
 * Native and NON-PASSIVE, which is the whole reason this is an effect rather than an `onWheel`
 * prop: React delivers `wheel` passively, where `preventDefault` is a no-op and the panel behind
 * the band scrolls instead.
 *
 * `viewportNow` is read at the moment of the gesture rather than closed over: a viewport captured
 * when the listener was hung would undo every scroll since. It is kept in a ref, refreshed by an
 * effect rather than during the render — `react-hooks/refs` refuses the latter — so a caller may
 * pass a fresh closure on every render without the listener being torn down and hung again, which
 * is what the non-passive registration costs.
 */
export function useTimelineWheel(
  ref: RefObject<HTMLCanvasElement | null>,
  viewportNow: () => Viewport,
  setViewport: (next: Viewport) => void,
) {
  const latest = useRef(viewportNow)

  useEffect(() => {
    latest.current = viewportNow
  }, [viewportNow])

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return

    const onWheel = (event: WheelEvent): void => {
      event.preventDefault()
      const current = latest.current()

      if (event.ctrlKey || event.metaKey) {
        const bounds = canvas.getBoundingClientRect()
        const factor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP
        setViewport(zoomAt(current, factor, event.clientX - bounds.left))
        return
      }

      // Shift turns a vertical wheel horizontal, as every editor does for a single-axis mouse.
      const horizontal = event.shiftKey ? event.deltaY : event.deltaX
      const vertical = event.shiftKey ? 0 : event.deltaY
      setViewport(scrollBy(current, horizontal, vertical))
    }

    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [ref, setViewport])
}

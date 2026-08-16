import { useEffect, useRef, type RefObject } from 'react'
import { scrollBy, zoomAt, ZOOM_STEP } from '@/engines/timeline/viewport'
import type { Viewport } from '@/engines/timeline/timeline-geometry'

/**
 * The wheel over a time band: zoom under the pointer with a modifier, scroll otherwise.
 *
 * Written once because the animation band and the video timeline spelt it identically — the same
 * gesture over the same kind of surface, and a fix to one of them left the other behind. The
 * column of NAMES takes it too: the two halves of a band answer one vocabulary, or the same wheel
 * zooms on the right of a gutter and scrolls on its left.
 *
 * Native and NON-PASSIVE, which is the whole reason this is an effect rather than an `onWheel`
 * prop: React delivers `wheel` passively, where `preventDefault` is a no-op and the panel behind
 * the band scrolls instead.
 *
 * BOTH callbacks are read at the moment of the gesture rather than closed over: a viewport
 * captured when the listener was hung would undo every scroll since, and a `setViewport` in the
 * deps would tear the listener down and hang it again on every render of the host — sixty times a
 * second while a montage plays, since the playhead re-renders it. They are kept in refs, refreshed
 * by an effect rather than during the render (`react-hooks/refs` refuses the latter), so a caller
 * may pass fresh closures on every render and still be listened to.
 */
export function useTimelineWheel(
  ref: RefObject<HTMLElement | null>,
  viewportNow: () => Viewport,
  setViewport: (next: Viewport) => void,
) {
  const latest = useRef({ viewportNow, setViewport })

  useEffect(() => {
    latest.current = { viewportNow, setViewport }
  }, [viewportNow, setViewport])

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const onWheel = (event: WheelEvent): void => {
      event.preventDefault()
      const { viewportNow: read, setViewport: write } = latest.current
      const current = read()

      if (event.ctrlKey || event.metaKey) {
        const bounds = element.getBoundingClientRect()
        const factor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP
        write(zoomAt(current, factor, event.clientX - bounds.left))
        return
      }

      // Shift turns a vertical wheel horizontal, as every editor does for a single-axis mouse.
      const horizontal = event.shiftKey ? event.deltaY : event.deltaX
      const vertical = event.shiftKey ? 0 : event.deltaY
      write(scrollBy(current, horizontal, vertical))
    }

    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [ref])
}

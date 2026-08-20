import { useEffect } from 'react'
import type { Viewport } from '@/engines/timeline/timelineGeometry'
import type { Us } from '@/engines/timeline/timelineState'
import { revealTime } from '@/engines/timeline/viewport'
import { useLatest } from './useLatest'

/** Where a surface stands right now: `null` while it has nothing to scroll. */
export type HeadFrame = { viewport: Viewport; width: number } | null

/**
 * Scrolls a time surface back onto the playhead once the head has left it — zoomed in, playing
 * ran off the right edge within seconds and the montage stayed on a moment nobody was watching.
 *
 * On the PLAYHEAD alone: woken by the view as well, this pulled the surface back the instant the
 * hand tool dragged it away, and chased its own clamped write — hence `useLatest` rather than a
 * dependency on either callback.
 */
export function useViewFollowsHead(
  playhead: Us,
  frame: () => HeadFrame,
  reveal: (viewport: Viewport) => void,
): void {
  const latestFrame = useLatest(frame)
  const latestReveal = useLatest(reveal)

  useEffect(() => {
    const current = latestFrame.current()
    // A surface that has not been laid out yet says nothing about what is on screen, and every
    // instant reads as off-frame against a width of zero.
    if (!current || current.width === 0) return

    // Identity, which `revealTime` guarantees while the head is inside the frame: a montage that
    // fits on screen must not scroll at all.
    const revealed = revealTime(current.viewport, playhead, current.width)
    if (revealed !== current.viewport) latestReveal.current(revealed)
  }, [playhead, latestFrame, latestReveal])
}

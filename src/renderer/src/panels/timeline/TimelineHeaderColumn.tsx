import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { clamp } from '@shared/numeric'
import { maxScrollTopFor } from '@/engines/timeline/band'
import { edgeScroll } from '@/engines/timeline/edge-scroll'
import { RULER_HEIGHT, type Viewport } from '@/engines/timeline/timeline-geometry'
import { useTimelineWheel } from '@/hooks/useTimelineWheel'
import { BandScrollContext, type BandScroll } from './bandScroll'

/**
 * How far the band may still travel, by the studio's own rule — measured off the DOM because the
 * column is the only place that knows the height of the stack it renders AND of the box that
 * clips it, neither of which the store keeps.
 *
 * No ruler in the sum: the spacer facing it is a sibling of the clipping box, not inside it.
 */
function roomBelow(clip: HTMLElement | null, stack: HTMLElement | null): number {
  if (!clip) return 0
  return maxScrollTopFor(stack?.offsetHeight ?? 0, clip.clientHeight, 0)
}

/**
 * The column of headers standing beside a band: one row per line, scrolled with the band.
 *
 * Shared by the three for the same reason `TimelineRow` is — the montage and the dope sheet had
 * each written this box, down to the spacer facing the ruler, and a change to one left the other
 * a line out of step with the rows it names.
 */
export function TimelineHeaderColumn({
  scrollTop,
  label,
  viewportNow,
  setViewport,
  children,
}: {
  scrollTop: number
  /**
   * What the list is called, already translated — the column draws what it is handed and looks
   * nothing up. Required rather than optional, as `Collection` and `Tree` require theirs and for
   * their reason: unnamed, a reader announces the bare word "list", and three surfaces of the
   * studio draw one.
   */
  label: string
  /**
   * The band's whole viewport, read at the moment of a gesture rather than subscribed to: the
   * wheel zooms, which needs the scale, and a column that re-drew every header on a zoom would
   * pay for a gesture that never touches a name.
   */
  viewportNow: () => Viewport
  setViewport: (next: Viewport) => void
  children: ReactNode
}) {
  const column = useRef<HTMLDivElement>(null)
  const clip = useRef<HTMLDivElement>(null)
  const stack = useRef<HTMLDivElement>(null)
  const [held, setHeld] = useState<{ pointerId: number; y: number } | null>(null)

  /**
   * Every offset this column writes, within its own bounds.
   *
   * The bound is the column's because it is the one that measured the stack — `scrollBy` leaves
   * the far end open, and the canvas beside it clamps against a height this side does not have.
   */
  const bounded = useCallback(
    (next: Viewport): void => {
      const current = viewportNow()
      const room = roomBelow(clip.current, stack.current)
      const scrollTop = clamp(Math.round(next.scrollTop), 0, room)

      // The same viewport back when nothing moved, as `clampViewport` does and for its reason:
      // a wheel held against the end of the stack would otherwise write on every notch and
      // repaint the strip beside it for nothing.
      if (scrollTop === current.scrollTop) return
      setViewport({ ...current, scrollTop })
    },
    [setViewport, viewportNow],
  )

  /**
   * The wheel over the names moves the stack, and NOTHING else.
   *
   * `useTimelineWheel` is reused for the gesture — non-passive, so the panel behind never scrolls
   * in its place — but only its vertical answer is kept. The other two are the strip's and cannot
   * be honoured here: a zoom holds an instant under the pointer, and there is no instant over a
   * name; a horizontal pan is bounded by the strip's own width and the sequence's duration, which
   * this side does not have. Writing them from here ran the montage off into empty space, which
   * `maxOffset` exists to refuse.
   */
  useTimelineWheel(column, viewportNow, bounded)

  // Read by the frame loop below, bound once for the whole gesture.
  const latest = useRef({ scrollTop, viewportNow, bounded })
  useEffect(() => {
    latest.current = { scrollTop, viewportNow, bounded }
  })

  // Stable for the column's whole life: a fresh object every draw would re-run the effect that
  // every grip inside binds to it, mid-gesture. State rather than a ref, which no component may
  // read while it renders.
  const [band] = useState<BandScroll>(() => ({
    onDrag: setHeld,
    scrollTop: () => latest.current.scrollTop,
  }))

  useEffect(() => {
    if (!held) return

    // Seeded from the press: a hand that takes a row already inside the margin and holds it
    // perfectly still makes no move at all, and the band would wait for one that never comes.
    let y: number | null = held.y
    // `null` and not zero: a clock that starts at zero would read every frame as the first.
    let previous: number | null = null
    let frame = 0
    // Kept across frames: a sixtieth of a second of travel is a fraction of a pixel at the foot
    // of the ramp, and rounding each frame on its own would round every one of them to nothing.
    let carry = 0

    const onMove = (event: globalThis.PointerEvent): void => {
      // That pointer and no other — the same guard the grip carries, for the same reason: a
      // second finger crossing the top margin would drag the held row up by itself.
      if (event.pointerId === held.pointerId) y = event.clientY
    }

    /**
     * The pointer has left the document, and nothing can be heard from it any more.
     *
     * A release out there never reaches this window: there is no capture to cost a `pointerup`,
     * and the window keeps its focus so no `blur` comes either. Travelling on the last known
     * position would then run the stack to its end and reorder a row through every rank of it,
     * with the hand no longer holding anything. Standing still is what this cost before the band
     * could travel at all, and it is what it costs again — the margin lies INSIDE the window, so
     * nothing needed for the gesture is given up.
     */
    const onOut = (event: globalThis.PointerEvent): void => {
      if (!event.relatedTarget) y = null
    }

    const step = (now: number): void => {
      frame = requestAnimationFrame(step)

      const seconds = previous === null ? 0 : (now - previous) / 1000
      previous = now

      const box = clip.current
      if (y === null || !box) return

      const room = roomBelow(box, stack.current)
      if (room <= 0) return

      const edges = box.getBoundingClientRect()
      carry += edgeScroll(y, { top: edges.top, bottom: edges.bottom }, seconds)

      const whole = Math.trunc(carry)
      if (whole === 0) return
      carry -= whole

      const held = latest.current
      const next = clamp(held.scrollTop + whole, 0, room)
      if (next !== held.scrollTop) held.bounded({ ...held.viewportNow(), scrollTop: next })
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerout', onOut)
    frame = requestAnimationFrame(step)

    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerout', onOut)
      cancelAnimationFrame(frame)
    }
  }, [held])

  return (
    <BandScrollContext value={band}>
      <div
        ref={column}
        className="border-border flex w-(--sc-track-header) shrink-0 flex-col overflow-hidden border-r"
      >
        {/* Empty band facing the ruler, so line one lines up with row one. */}
        <div style={{ height: RULER_HEIGHT }} />
        {/* Named because its height IS the bound the band scrolls within, and a test that had to
            find it by the transform was guessing at two things at once. */}
        <div ref={clip} data-testid="band-clip" className="min-h-0 flex-1 overflow-hidden">
          {/* On the stack and not on the box that clips it: a `listitem` counts only where the
              list OWNS it, and the rows are children of THIS node. It buys the announcement and
              nothing else — `InlineRename` hands the focus back to a `[tabindex="0"]` inside the
              list, and no row of any band carries a tab stop for it to find. */}
          <div
            ref={stack}
            role="list"
            aria-label={label}
            style={{ transform: `translateY(${-scrollTop}px)` }}
          >
            {children}
          </div>
        </div>
      </div>
    </BandScrollContext>
  )
}

import { useVirtualizer } from '@tanstack/react-virtual'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { scrollOffsetWithin, scrollParentOf } from '@/helpers/scroll-parent'
import { GAP, PREFETCH_ROWS } from './virtual'

/** A picture whose shape nobody stated. Square is the least wrong guess, and never distorts. */
const FALLBACK_RATIO = 1

/** Beyond this a column is too narrow to read, so the grid drops one rather than shrink on. */
const MIN_COLUMN_WIDTH = 120

export type MasonryProps<T extends { id: string }> = {
  items: readonly T[]
  renderCard: (item: T) => ReactNode
  /**
   * The shape of an item, as width ÷ height — what reserves its place BEFORE the picture is
   * fetched. `undefined` for an asset the API stated no dimensions for, which is common enough
   * to be ordinary rather than an error.
   */
  ratioOf: (item: T) => number | undefined
  /** What one column aims for. The real width divides the space evenly, never below the aim. */
  columnWidth: number
  /** Names the region for a screen reader. */
  label: string
  /** Called as the end nears. Must tolerate being called again before it has answered. */
  onReachEnd?: () => void
  /** Shown in place of the grid — the caller decides whether it means empty or unmatched. */
  empty?: ReactNode
}

/**
 * A grid of free-height columns, virtualized against a scroll container it does not own.
 *
 * That last part is the whole difference with `Collection`, which scrolls inside itself. The
 * home holds the only scroll on the screen, so this hangs off whatever scrolls it — found by
 * walking up rather than passed down, since every component in between would otherwise have to
 * carry a ref it makes no use of.
 *
 * Each item's height is computed from its own aspect ratio, so the place is reserved before the
 * picture arrives and nothing below it ever jumps. Heights are therefore never measured from the
 * DOM: the estimate IS the truth, which is also what lets the virtualizer assign lanes up front.
 */
export function Masonry<T extends { id: string }>({
  items,
  renderCard,
  ratioOf,
  columnWidth,
  label,
  onReachEnd,
  empty,
}: MasonryProps<T>) {
  const host = useRef<HTMLDivElement>(null)
  const [scroller, setScroller] = useState<HTMLElement | null>(null)
  const [width, setWidth] = useState(0)
  const [scrollMargin, setScrollMargin] = useState(0)

  // The page itself when nothing above scrolls: a virtualizer with no scroll element renders
  // nothing at all, and a grid that is silently blank is worse than one that is not virtualized.
  useEffect(() => setScroller(scrollParentOf(host.current) ?? document.documentElement), [])

  useEffect(() => {
    const element = host.current
    if (!element) return

    const observer = new ResizeObserver(entries => {
      const measured = entries[0]?.contentRect.width
      if (measured !== undefined) setWidth(measured)
    })

    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  /**
   * Where this grid starts inside the scroll container, re-read on scroll rather than once.
   *
   * The sections above it fill in as their own reads land, and each one that grows pushes this
   * down. Nothing observable fires for that from here — the grid's own box does not change — so
   * the honest options are to measure on every frame of scroll or to be wrong for a while. One
   * `getBoundingClientRect` per frame, coalesced, is the cheaper of the two.
   */
  const pending = useRef(0)

  const measureOffset = useCallback(() => {
    if (pending.current !== 0 || !scroller) return

    pending.current = requestAnimationFrame(() => {
      pending.current = 0
      const element = host.current
      if (!element || !scroller) return

      const offset = scrollOffsetWithin(element, scroller) + scroller.scrollTop
      // Same value, no re-render: this runs on every frame of a scroll.
      setScrollMargin(current => (current === offset ? current : offset))
    })
  }, [scroller])

  useEffect(() => () => cancelAnimationFrame(pending.current), [])

  useEffect(() => {
    if (!scroller) return

    measureOffset()
    scroller.addEventListener('scroll', measureOffset, { passive: true })
    return () => scroller.removeEventListener('scroll', measureOffset)
  }, [scroller, measureOffset])

  const columns = Math.max(1, Math.floor((width + GAP) / (Math.max(columnWidth, 1) + GAP)))
  const lanes = width >= MIN_COLUMN_WIDTH ? columns : 1
  const laneWidth = (width - (lanes - 1) * GAP) / lanes

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scroller,
    estimateSize: index => {
      const item = items[index]
      const ratio = item ? (ratioOf(item) ?? FALLBACK_RATIO) : FALLBACK_RATIO
      // A ratio of zero or worse would collapse the cell and stack every item at one offset.
      return laneWidth / (ratio > 0 ? ratio : FALLBACK_RATIO)
    },
    lanes,
    gap: GAP,
    scrollMargin,
    overscan: 2,
    // Nothing here is measured from the DOM, so lanes are settled from the estimates alone.
    laneAssignmentMode: 'estimate',
  })

  // The virtualizer memoizes its measurements on `count` and friends, never on the estimator:
  // without this, a resize leaves every cell at the height the previous width gave it.
  useEffect(() => virtualizer.measure(), [virtualizer, laneWidth, lanes])

  const virtualItems = virtualizer.getVirtualItems()
  const last = virtualItems.at(-1)?.index ?? 0
  /**
   * An empty grid is NOT the end of one. Asking for more with nothing on screen loops until the
   * source runs dry — the caller knows whether an empty answer is worth another request.
   */
  const nearEnd = items.length > 0 && last >= items.length - lanes * PREFETCH_ROWS

  useEffect(() => {
    if (nearEnd) onReachEnd?.()
  }, [nearEnd, items.length, onReachEnd])

  return (
    <div ref={host} role="region" aria-label={label}>
      {items.length === 0 ? (
        empty
      ) : (
        <div style={{ height: virtualizer.getTotalSize() }} className="relative">
          {virtualItems.map(virtual => {
            const item = items[virtual.index]
            if (!item) return null

            return (
              <div
                key={item.id}
                style={{
                  // `start` counts from the top of the scroll container; the grid draws from its
                  // own top, which is exactly `scrollMargin` further down.
                  transform: `translateY(${virtual.start - scrollMargin}px)`,
                  left: virtual.lane * (laneWidth + GAP),
                  width: laneWidth,
                  height: virtual.size,
                }}
                className="absolute top-0"
              >
                {renderCard(item)}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

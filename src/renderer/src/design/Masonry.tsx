import { useVirtualizer } from '@tanstack/react-virtual'
import { clamp } from '@shared/numeric'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { scrollOffsetWithin, scrollParentOf } from '@/helpers/scrollParent'
import { useElementWidth } from '@/hooks/useElementWidth'
import { useReachEnd } from '@/hooks/useReachEnd'
import { useRemeasure } from '@/hooks/useRemeasure'
import { useScrollHost } from '@/hooks/useScrollHost'
import { columnsIn, GAP, PREFETCH_ROWS } from './virtual'

/** A picture whose shape nobody stated. Square is the least wrong guess, and never distorts. */
const FALLBACK_RATIO = 1

/**
 * How far from square a tile may go, as width ÷ height.
 *
 * Seamless textures are published at 3584×512 — seven to one. Reserved faithfully, they draw a
 * letterbox strip a few pixels tall beside square tiles, and a column of them reads as a list of
 * captions rather than as pictures. Past these bounds the picture is cropped by `object-cover`
 * instead: showing the middle of a tiling texture loses nothing, and the grid stays legible.
 */
const RATIO_MIN = 0.5
const RATIO_MAX = 2

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
  const published = useScrollHost()
  /** `undefined` while nothing has been looked for yet; `null` once nothing was found. */
  const [scroller, setScroller] = useState<HTMLElement | null | undefined>(undefined)
  // An integer, and that is the point rather than a detail: `laneWidth` is a float derived from it,
  // and a fractional pixel of a resize would otherwise re-estimate all N cells (invariant 6).
  const width = useElementWidth(host)
  const [scrollMargin, setScrollMargin] = useState(0)

  // The page's own scroller when a page publishes one, and a walk up the tree only where none
  // does. Never `document.documentElement` as a last resort: the page's scroll is dispatched on
  // `document`, and `firstElementChild` of `<html>` is `<head>`, which has no box — that fallback
  // produced a grid that could not be scrolled at all, worse than one that is not virtualized.
  useEffect(() => {
    // `null` is a published scroller that has not mounted yet: waiting one render beats guessing,
    // and guessing here would leave the heuristic doing the work on the render that matters.
    if (published === null) return
    setScroller(published ?? scrollParentOf(host.current))
  }, [published])

  /**
   * Where this grid starts inside the scroll container.
   *
   * Watched rather than polled: the value is invariant under scrolling — moving down by one
   * pixel lowers the grid's box by one and raises `scrollTop` by one — so reading it per frame
   * would recompute the same number all the way down. It moves only when a section ABOVE
   * changes height, which is what the observer below fires on.
   */
  useEffect(() => {
    const content = scroller?.firstElementChild
    const element = host.current
    if (!scroller || !content || !element) return

    const measure = (): void => {
      const offset = scrollOffsetWithin(element, scroller) + scroller.scrollTop
      setScrollMargin(current => (current === offset ? current : offset))
    }

    measure()
    // The page's content, not the scroller: the window keeping its size while a band above
    // fills in is precisely the case, and only the content grows then.
    const observer = new ResizeObserver(measure)
    observer.observe(content)
    return () => observer.disconnect()
  }, [scroller])

  const { columns, columnWidth: laneWidth } = columnsIn(width, columnWidth)
  const lanes = columns

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scroller ?? null,
    estimateSize: index => {
      const item = items[index]
      const stated = item ? (ratioOf(item) ?? FALLBACK_RATIO) : FALLBACK_RATIO
      // A ratio of zero or worse would collapse the cell and stack every item at one offset.
      const ratio = stated > 0 ? stated : FALLBACK_RATIO
      return laneWidth / clamp(ratio, RATIO_MIN, RATIO_MAX)
    },
    lanes,
    gap: GAP,
    scrollMargin,
    overscan: 2,
    // Nothing here is measured from the DOM, so lanes are settled from the estimates alone.
    laneAssignmentMode: 'estimate',
  })

  // Rounded to the pixel: a lane a third of a pixel narrower draws the same grid, and a re-measure
  // rebuilds all N estimates — 35 µs at 400 items, measured. Roughly a `columns`-fold reduction
  // during a drag, not an elimination; the rounding of `width` above is what removes the render.
  useRemeasure(virtualizer, `${lanes}:${Math.round(laneWidth)}`)

  const virtualItems = virtualizer.getVirtualItems()
  useReachEnd(
    { last: virtualItems.at(-1)?.index ?? 0, count: items.length, ahead: lanes * PREFETCH_ROWS },
    onReachEnd,
  )

  // Nothing scrolls this, so nothing can be left out of it: the whole set is laid out in CSS
  // columns instead. Unreachable from the home, which publishes its scroller — this is for a
  // caller that mounts a grid inside a surface with no scroll of its own.
  if (scroller === null && items.length > 0) {
    return (
      <div
        ref={host}
        role="region"
        aria-label={label}
        style={{ columnCount: lanes, columnGap: GAP }}
      >
        {items.map(item => (
          <div key={item.id} style={{ marginBottom: GAP }} className="break-inside-avoid">
            {renderCard(item)}
          </div>
        ))}
      </div>
    )
  }

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

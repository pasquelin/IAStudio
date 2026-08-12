import { mdiChevronLeft, mdiChevronRight } from '@mdi/js'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/helpers/cn'
import { FOCUS_RING, SHELF_OVERLAY } from './styles'
import { TIP_BOTTOM, TIP_TOP } from '@/helpers/tooltip'
import { UiIcon } from './UiIcon'
import { GAP } from './virtual'

/**
 * Beyond this, dots count rather than orient: a reader cannot tell the eleventh from the
 * twelfth, and the row of them starts competing with the content it sits under.
 */
const MAX_DOTS = 12

/** A page keeps a sliver of the previous one on screen, so a scroll never loses its place. */
const PAGE_OVERLAP = 40

export type CarouselProps<T extends { id: string }> = {
  items: readonly T[]
  renderCard: (item: T) => ReactNode
  itemWidth: number
  itemHeight: number
  /** Names the region for a screen reader. Every carousel on the home says what it holds. */
  label: string
  /** Shown in place of the rail — the caller decides whether it means empty or unmatched. */
  empty?: ReactNode
}

type Position = {
  page: number
  pages: number
  atStart: boolean
  atEnd: boolean
}

const START: Position = { page: 0, pages: 1, atStart: true, atEnd: true }

function positionOf(rail: HTMLElement): Position {
  const { clientWidth, scrollWidth, scrollLeft } = rail
  if (clientWidth === 0) return START

  const pages = Math.max(1, Math.ceil(scrollWidth / clientWidth))

  return {
    pages,
    page: Math.min(pages - 1, Math.round(scrollLeft / clientWidth)),
    atStart: scrollLeft <= 1,
    // A rounded scroll width can sit a fraction short of its own end; a pixel of slack is what
    // keeps the right arrow from staying enabled on a rail already scrolled to the end.
    atEnd: scrollLeft + clientWidth >= scrollWidth - 1,
  }
}

/**
 * A horizontal rail of cards: native scrolling, snapping, arrows and page dots.
 *
 * Virtualized like `Collection` is, and for the same reason — the home draws several of these
 * at once, and a shelf of forty tiles that mounts forty tiles costs a frame nobody asked for.
 * The trade it makes is real: only mounted cards are reachable with `Tab`, which is why the
 * rail itself takes focus and scrolls with the arrow keys.
 *
 * Nothing here animates on its own. There is no autoplay: a studio screen that moves while
 * being read is a screen that cannot be read.
 */
export function Carousel<T extends { id: string }>({
  items,
  renderCard,
  itemWidth,
  itemHeight,
  label,
  empty,
}: CarouselProps<T>) {
  const { t } = useTranslation()
  const rail = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<Position>(START)

  const virtualizer = useVirtualizer({
    horizontal: true,
    count: items.length,
    getScrollElement: () => rail.current,
    estimateSize: () => itemWidth + GAP,
    overscan: 3,
  })

  // Coalesced to one reading per frame: a trackpad fires scroll a hundred times a second, and
  // `positionOf` reads three layout properties — enough to force a reflow on each of them.
  const pending = useRef(0)

  const measure = useCallback(() => {
    if (pending.current !== 0) return

    pending.current = requestAnimationFrame(() => {
      pending.current = 0
      const element = rail.current
      if (!element) return

      const next = positionOf(element)
      // Same values, same object: a scroll inside one page must not re-render the dots.
      setPosition(current =>
        current.page === next.page &&
        current.pages === next.pages &&
        current.atStart === next.atStart &&
        current.atEnd === next.atEnd
          ? current
          : next,
      )
    })
  }, [])

  useEffect(() => () => cancelAnimationFrame(pending.current), [])

  // An empty shelf draws no rail at all, so there is nothing to observe until the first item
  // arrives — and a list fetched from disk starts empty. Without this dependency the observer
  // is never installed for such a shelf, and it keeps its arrows and dots for good.
  const railed = items.length > 0

  useEffect(() => {
    const element = rail.current
    if (!element) return

    // The rail and the sizer inside it: one reports a window resized, the other a page of items
    // arriving. Without the second, the forward arrow stays hidden on a shelf that just grew.
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    if (element.firstElementChild) observer.observe(element.firstElementChild)
    return () => observer.disconnect()
  }, [measure, railed])

  const virtualItems = virtualizer.getVirtualItems()

  /**
   * `behavior` is deliberately not passed: left to the stylesheet, the scroll follows
   * `scroll-behavior`, which `[data-reduce-motion]` overrides in `index.css`. Naming it here
   * would animate the rail for someone who asked the studio to hold still.
   */
  const scrollByPage = (direction: -1 | 1): void => {
    const element = rail.current
    if (!element) return
    element.scrollBy({ left: direction * Math.max(itemWidth, element.clientWidth - PAGE_OVERLAP) })
  }

  const scrollToPage = (page: number): void => {
    const element = rail.current
    if (!element) return
    element.scrollTo({ left: page * element.clientWidth })
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    const element = rail.current
    if (!element) return

    if (event.key === 'ArrowRight') element.scrollBy({ left: itemWidth + GAP })
    else if (event.key === 'ArrowLeft') element.scrollBy({ left: -(itemWidth + GAP) })
    else if (event.key === 'Home') element.scrollTo({ left: 0 })
    else if (event.key === 'End') element.scrollTo({ left: element.scrollWidth })
    else return

    event.preventDefault()
  }

  if (items.length === 0) return empty ?? null

  const dots = position.pages > 1 && position.pages <= MAX_DOTS

  return (
    <div className="group/carousel relative">
      <div
        ref={rail}
        role="region"
        aria-label={label}
        tabIndex={0}
        onScroll={measure}
        onKeyDown={onKeyDown}
        style={{ height: itemHeight }}
        className={cn(
          'snap-x snap-proximity overflow-x-auto overflow-y-hidden scroll-smooth',
          FOCUS_RING,
        )}
      >
        <div style={{ width: virtualizer.getTotalSize() }} className="relative h-full">
          {virtualItems.map(virtual => {
            const item = items[virtual.index]
            if (!item) return null

            return (
              <div
                key={item.id}
                style={{ transform: `translateX(${virtual.start}px)`, width: itemWidth }}
                className="absolute top-0 left-0 h-full snap-start"
              >
                {renderCard(item)}
              </div>
            )
          })}
        </div>
      </div>

      <Arrow side="left" hidden={position.atStart} onClick={() => scrollByPage(-1)} />
      <Arrow side="right" hidden={position.atEnd} onClick={() => scrollByPage(1)} />

      {dots && (
        <div className="mt-2 flex justify-center gap-1.5">
          {Array.from({ length: position.pages }, (_, page) => (
            <button
              key={page}
              type="button"
              {...TIP_BOTTOM(t('carousel.page', { number: page + 1 }))}
              aria-current={page === position.page ? 'true' : undefined}
              onClick={() => scrollToPage(page)}
              // Which page is current is said by the WIDTH, not by the colour alone: `text` and
              // `muted` sit 2.30:1 apart, under the 3:1 WCAG 1.4.11 asks of a state. `transition-all`
              // and not `-colors`, or the dot would snap wide while its fill faded.
              className={cn(
                'h-1.5 cursor-pointer rounded-full border-none p-0 transition-all',
                page === position.page ? 'bg-text w-4' : 'bg-muted hover:bg-text w-1.5',
                FOCUS_RING,
              )}
            />
          ))}
        </div>
      )}
    </div>
  )
}

type ArrowProps = {
  side: 'left' | 'right'
  hidden: boolean
  onClick: () => void
}

/**
 * Revealed by hovering the shelf: a control permanently laid over the artwork hides part of
 * what the shelf exists to show. It disappears at the end it can no longer serve rather than
 * sitting there greyed — there is no rail left to point at.
 *
 * Named, so a screen reader can announce it, but out of the tab order: the rail itself takes
 * focus and scrolls with the arrow keys, which is the shorter path. A tab stop per direction
 * on every shelf would put a dozen presses between the home and its first card.
 */
function Arrow({ side, hidden, onClick }: ArrowProps) {
  const { t } = useTranslation()
  if (hidden) return null

  return (
    <button
      type="button"
      tabIndex={-1}
      {...TIP_TOP(t(side === 'left' ? 'carousel.previous' : 'carousel.next'))}
      onClick={onClick}
      className={cn(
        SHELF_OVERLAY,
        'text-text top-1/2 size-7 -translate-y-1/2',
        'hover:bg-elevated shadow-(--sc-shadow-floating)',
        side === 'left' ? 'left-1' : 'right-1',
      )}
    >
      <UiIcon path={side === 'left' ? mdiChevronLeft : mdiChevronRight} size={16} />
    </button>
  )
}

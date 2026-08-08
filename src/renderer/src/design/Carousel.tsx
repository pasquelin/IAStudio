import { mdiChevronLeft, mdiChevronRight } from '@mdi/js'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/helpers/cn'
import { FOCUS_RING } from './styles'
import { UiIcon } from './UiIcon'

/** The same gutter the collection puts between its cards, for the same reason. */
const GAP = 8

/** How many items from the end the next page is asked for — before the user sees it. */
const PREFETCH_ITEMS = 4

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
  /** Called as the end nears. Must tolerate being called again before it has answered. */
  onReachEnd?: () => void
  /** The items currently on screen, for whatever a card needs fetched only when it is seen. */
  onVisible?: (items: readonly T[]) => void
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
  onReachEnd,
  onVisible,
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

  const measure = useCallback(() => {
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
  }, [])

  useEffect(() => {
    const element = rail.current
    if (!element) return

    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [measure])

  // The rail grows as pages arrive, and a scroll is not what reports that: without this, the
  // right arrow stays disabled on a shelf that has just been extended.
  useEffect(measure, [measure, items.length, itemWidth])

  const virtualItems = virtualizer.getVirtualItems()
  const first = virtualItems[0]?.index ?? 0
  const last = virtualItems.at(-1)?.index ?? 0

  /**
   * An empty rail is NOT the end of one. Asking for more with nothing on screen loops until the
   * source runs dry — the caller knows whether an empty answer is worth another request.
   */
  const nearEnd = items.length > 0 && last >= items.length - PREFETCH_ITEMS

  useEffect(() => {
    if (nearEnd) onReachEnd?.()
  }, [nearEnd, items.length, onReachEnd])

  useEffect(() => {
    if (!onVisible) return
    const shown = items.slice(first, last + 1)
    if (shown.length) onVisible(shown)
  }, [onVisible, items, first, last])

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
        style={{ height: itemHeight, scrollSnapType: 'x proximity' }}
        className={cn('overflow-x-auto overflow-y-hidden scroll-smooth', FOCUS_RING)}
      >
        <div style={{ width: virtualizer.getTotalSize() }} className="relative h-full">
          {virtualItems.map(virtual => {
            const item = items[virtual.index]
            if (!item) return null

            return (
              <div
                key={item.id}
                style={{
                  transform: `translateX(${virtual.start}px)`,
                  width: itemWidth,
                  scrollSnapAlign: 'start',
                }}
                className="absolute top-0 left-0 h-full"
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
              aria-label={t('carousel.page', { number: page + 1 })}
              aria-current={page === position.page ? 'true' : undefined}
              onClick={() => scrollToPage(page)}
              className={cn(
                'h-1.5 w-1.5 cursor-pointer rounded-full border-none p-0 transition-colors',
                page === position.page ? 'bg-text' : 'bg-muted/40 hover:bg-muted',
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
      aria-label={t(side === 'left' ? 'carousel.previous' : 'carousel.next')}
      onClick={onClick}
      className={cn(
        'absolute top-1/2 z-10 flex size-7 -translate-y-1/2 cursor-pointer items-center',
        'border-border bg-panel/90 text-text justify-center rounded-full border',
        'opacity-0 transition-opacity group-hover/carousel:opacity-100',
        'hover:bg-elevated shadow-(--sc-shadow-floating)',
        side === 'left' ? 'left-1' : 'right-1',
      )}
    >
      <UiIcon path={side === 'left' ? mdiChevronLeft : mdiChevronRight} size={16} />
    </button>
  )
}

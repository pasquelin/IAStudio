import { useVirtualizer } from '@tanstack/react-virtual'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from './cn'
import type { CollectionState } from './collection-state'

const GAP = 8
const ROW_HEIGHT = 26
/** Breathing room between list rows. Rows that touch read as one block rather than a list. */
const ROW_GAP = 4
/** How many rows from the bottom the next page is asked for — before the user sees the end. */
const PREFETCH_ROWS = 3

export type CollectionProps<T extends { id: string }> = {
  items: readonly T[]
  state: CollectionState
  renderCard: (item: T) => ReactNode
  renderRow: (item: T) => ReactNode
  selectedId?: string | null
  onSelect?: (item: T) => void
  /** Called as the end nears. Must tolerate being called again before it has answered. */
  onReachEnd?: () => void
  /** The items currently on screen, for whatever a card needs fetched only when it is seen. */
  onVisible?: (items: readonly T[]) => void
  /** Shown in place of the items — the caller decides whether it means empty or unmatched. */
  empty?: ReactNode
  footer?: ReactNode
  /** Height of a list row. Rows carrying a thumbnail need more than a line of text. */
  rowHeight?: number
}

type Grid = {
  columns: number
  /**
   * What one column actually measures. Cards are square and fill their column, so this — not
   * the requested thumbnail size — is their height, and estimating a row from the request
   * instead makes every row shorter than its content and the grid overlaps itself.
   */
  columnWidth: number
}

/**
 * How the cards divide the available width. `observe` reports the current size straight away,
 * so no separate first measurement is needed; until it fires, one column is the honest answer
 * rather than a guess.
 */
function useGrid(host: { current: HTMLElement | null }, cardWidth: number): Grid {
  const [grid, setGrid] = useState<Grid>({ columns: 1, columnWidth: cardWidth })

  useEffect(() => {
    const element = host.current
    if (!element) return

    const observer = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width
      if (width === undefined) return

      const columns = Math.max(1, Math.floor((width + GAP) / (cardWidth + GAP)))
      const columnWidth = (width - (columns - 1) * GAP) / columns

      // Same values, same object: a resize that changes neither must not re-render the grid.
      setGrid(current =>
        current.columns === columns && current.columnWidth === columnWidth
          ? current
          : { columns, columnWidth },
      )
    })

    observer.observe(element)
    return () => observer.disconnect()
  }, [host, cardWidth])

  return grid
}

/**
 * A collection rendered as a virtualized grid or list. It holds no filtering of its own: the
 * caller passes the items it wants shown, because only the caller knows whether they were
 * narrowed in memory or by the API.
 */
export function Collection<T extends { id: string }>({
  items,
  state,
  renderCard,
  renderRow,
  selectedId,
  onSelect,
  onReachEnd,
  onVisible,
  empty,
  footer,
  rowHeight = ROW_HEIGHT,
}: CollectionProps<T>) {
  const scroller = useRef<HTMLDivElement>(null)
  const grid = state.view === 'grid'
  const fitting = useGrid(scroller, state.thumbnailSize)

  const columns = grid ? fitting.columns : 1
  const rows = Math.ceil(items.length / columns)
  /**
   * A card is its column, square — the collection makes no guess about what the caller draws
   * inside it. The gap is part of the row the virtualizer reserves, and given back as padding
   * below the cell: a margin would be swallowed by the absolute positioning of each row.
   */
  const size = grid ? fitting.columnWidth + GAP : rowHeight + ROW_GAP

  const virtualizer = useVirtualizer({
    count: rows,
    getScrollElement: () => scroller.current,
    estimateSize: () => size,
    overscan: grid ? 2 : 8,
  })

  // The virtualizer memoizes its measurements on `count` and friends, never on the estimator
  // itself: without this, resizing the thumbnails leaves every row at its former height.
  useEffect(() => virtualizer.measure(), [virtualizer, size])

  const virtualRows = virtualizer.getVirtualItems()
  const lastRow = virtualRows.at(-1)?.index ?? 0
  /**
   * An empty collection is NOT the end of one. Asking for more with nothing on screen loops
   * until the source runs dry — the caller knows whether an empty answer is worth another
   * request, and this component does not.
   */
  const nearEnd = rows > 0 && lastRow >= rows - PREFETCH_ROWS

  useEffect(() => {
    if (nearEnd) onReachEnd?.()
  }, [nearEnd, rows, onReachEnd])

  const firstVisible = virtualRows[0]?.index ?? 0
  useEffect(() => {
    if (!onVisible) return
    const shown = items.slice(firstVisible * columns, (lastRow + 1) * columns)
    if (shown.length) onVisible(shown)
  }, [onVisible, items, firstVisible, lastRow, columns])

  return (
    <div ref={scroller} className="h-full overflow-auto p-2">
      {items.length === 0 ? (
        empty
      ) : (
        <div style={{ height: virtualizer.getTotalSize() }} className="relative">
          {virtualRows.map(row => {
            const slice = items.slice(row.index * columns, (row.index + 1) * columns)

            return (
              <div
                key={row.key}
                style={{
                  transform: `translateY(${row.start}px)`,
                  height: row.size,
                  ...(grid
                    ? { gap: GAP, gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }
                    : { paddingBottom: ROW_GAP }),
                }}
                className={cn(
                  'absolute inset-x-0 top-0 box-border',
                  grid ? 'grid items-start' : 'flex',
                )}
              >
                {slice.map(item => (
                  <CollectionCell
                    key={item.id}
                    selected={item.id === selectedId}
                    // A list row spans the collection; a card is sized by its grid column.
                    className={grid ? undefined : 'h-full w-full'}
                    onSelect={onSelect ? () => onSelect(item) : undefined}
                  >
                    {grid ? renderCard(item) : renderRow(item)}
                  </CollectionCell>
                ))}
              </div>
            )
          })}
        </div>
      )}
      {footer}
    </div>
  )
}

type CollectionCellProps = {
  selected: boolean
  onSelect?: () => void
  className?: string
  children: ReactNode
}

/**
 * Selection and keyboard reach belong to the collection, not to the cards: a caller that had
 * to wire them itself would wire them differently in each panel.
 */
function CollectionCell({ selected, onSelect, className, children }: CollectionCellProps) {
  /**
   * Hover and selection are painted here rather than by the rendered item: a background set
   * inside the cell would sit on top of this one and swallow it on hover.
   */
  const skin = cn(
    'min-w-0 rounded-(--radius-sc-sm)',
    selected ? 'bg-accent-soft' : 'hover:bg-surface',
    className,
  )

  if (!onSelect) return <div className={skin}>{children}</div>

  return (
    <div
      role="option"
      tabIndex={0}
      aria-selected={selected}
      onClick={onSelect}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect()
        }
      }}
      // The ring marks keyboard focus alone: it and selection are different states.
      className={cn(
        skin,
        'focus-visible:ring-accent cursor-pointer outline-none focus-visible:ring-1',
      )}
    >
      {children}
    </div>
  )
}

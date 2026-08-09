import { useVirtualizer } from '@tanstack/react-virtual'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/helpers/cn'
import { LIST_ONLY, type CollectionState } from '@/helpers/collection-state'
import { pickFrom, type Modifiers, type SelectionMode } from '@/helpers/selection'
import { rowSkin } from './styles'
import { columnsIn, GAP, PREFETCH_ROWS } from './virtual'

const ROW_HEIGHT = 26
/** Breathing room between list rows. Rows that touch read as one block rather than a list. */
const ROW_GAP = 4

export type CollectionProps<T extends { id: string }> = {
  items: readonly T[]
  /** Absent for a panel with no collection bar: a plain virtualized list, never a grid. */
  state?: CollectionState
  /**
   * Absent keeps the collection in list mode whatever `state.view` says: a panel with no
   * thumbnails has no card to draw, and inventing one so it is never called is noise.
   */
  renderCard?: (item: T) => ReactNode
  renderRow: (item: T) => ReactNode
  /**
   * What the list is called. A `listbox` is a widget, and an unnamed widget is announced as the
   * bare word "listbox" — the same word in all six panels that draw one.
   */
  label: string
  /**
   * Whether picking one row keeps the others. Declared rather than deduced: `pickFrom` hands
   * shift and ⌘ to every caller, but three of them keep a single id and would be announcing a
   * range they never build.
   */
  multiple?: boolean
  /** Ordered like `Tree`'s: the last one is the anchor, and it is where the tab stop sits. */
  selectedIds?: readonly string[]
  /**
   * What the click asked for, resolved against the items in the order they are drawn — the same
   * gesture `Tree` offers, so a row behaves alike whichever panel lists it. A caller that only
   * ever selects one thing can ignore both extra arguments.
   */
  onSelect?: (item: T, ids: readonly string[], mode: SelectionMode) => void
  /**
   * What opening an item means — a double-click, or Enter. Separate from `onSelect` because a
   * panel can offer one without the other: the explorer opens rows it never selects, and a
   * caller that wired the gesture itself would leave its rows out of the keyboard's reach.
   */
  onActivate?: (item: T) => void
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

type CollectionRoles = { list?: 'listbox' | 'list'; cell?: 'option' | 'listitem' }

/**
 * Container and cell are one pair, never two decisions: an `option` outside a `listbox` is
 * invalid ARIA — no list announced, no "3 of 12", and some engines drop the role outright.
 */
function rolesFor(pickable: boolean, openable: boolean): CollectionRoles {
  if (pickable) return { list: 'listbox', cell: 'option' }
  if (openable) return { list: 'list', cell: 'listitem' }

  return {}
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
function useGrid(host: { current: HTMLElement | null }, cardWidth: number, enabled: boolean): Grid {
  const [grid, setGrid] = useState<Grid>({ columns: 1, columnWidth: cardWidth })

  useEffect(() => {
    const element = host.current
    // A list-only collection never reads this, and `columnWidth` is a float that changes with
    // every pixel of a splitter drag — the observer would re-render the window twice a frame.
    if (!element || !enabled) return

    const observer = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width
      if (width === undefined) return

      const { columns, columnWidth } = columnsIn(width, cardWidth)

      // Same values, same object: a resize that changes neither must not re-render the grid.
      setGrid(current =>
        current.columns === columns && current.columnWidth === columnWidth
          ? current
          : { columns, columnWidth },
      )
    })

    observer.observe(element)
    return () => observer.disconnect()
  }, [host, cardWidth, enabled])

  return grid
}

/**
 * A collection rendered as a virtualized grid or list. It holds no filtering of its own: the
 * caller passes the items it wants shown, because only the caller knows whether they were
 * narrowed in memory or by the API.
 */
export function Collection<T extends { id: string }>({
  items,
  state = LIST_ONLY,
  label,
  multiple,
  renderCard,
  renderRow,
  selectedIds,
  onSelect,
  onActivate,
  onReachEnd,
  onVisible,
  empty,
  footer,
  rowHeight = ROW_HEIGHT,
}: CollectionProps<T>) {
  const scroller = useRef<HTMLDivElement>(null)
  // Kept as the narrowed function rather than a boolean, so the cell below needs no second guard.
  const card = state.view === 'grid' ? renderCard : undefined
  const grid = card !== undefined
  const fitting = useGrid(scroller, state.thumbnailSize, grid)

  const roles = rolesFor(onSelect !== undefined, onActivate !== undefined)
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

  /**
   * One tab stop for the whole collection, then the arrows — the roving pattern `Tree` uses.
   * A cell per tab makes a catalogue of five hundred models five hundred presses deep.
   */
  const selected = new Set(selectedIds)
  // The anchor is a notion of selection. A collection that only opens its rows has none, and
  // taking the entry point from what it paints would land the tab on a row nobody picked —
  // the explorer paints the documents that are open, which it does not choose.
  const anchor = onSelect ? selectedIds?.at(-1) : undefined
  const anchored = items.findIndex(item => item.id === anchor)
  const firstMounted = firstVisible * columns
  // The tab stop must be a cell that exists: the virtualizer only mounts a window, and an anchor
  // scrolled out of it would leave the whole collection out of the tab order.
  const tabStop =
    anchored >= firstMounted && anchored <= (lastRow + 1) * columns - 1 ? anchored : firstMounted

  const pick = (item: T, modifiers: Modifiers): void => {
    const { ids, mode } = pickFrom(
      items.map(candidate => candidate.id),
      anchor,
      item.id,
      modifiers,
    )
    onSelect?.(item, ids, mode)
  }

  const focusCell = (index: number): void => {
    const bounded = Math.max(0, Math.min(index, items.length - 1))
    virtualizer.scrollToIndex(Math.floor(bounded / columns))

    const focus = (): void => {
      scroller.current?.querySelector<HTMLElement>(`[data-cell="${bounded}"]`)?.focus()
    }
    // Twice: the cell is already mounted in the common case, and only a scroll that revealed a
    // new row needs the frame the virtualizer takes to render it.
    focus()
    requestAnimationFrame(focus)
  }

  const onCellKeyDown = (index: number, event: KeyboardEvent): void => {
    if (event.key === 'ArrowRight') focusCell(index + 1)
    else if (event.key === 'ArrowLeft') focusCell(index - 1)
    else if (event.key === 'ArrowDown') focusCell(index + columns)
    else if (event.key === 'ArrowUp') focusCell(index - columns)
    else return

    event.preventDefault()
  }

  return (
    // A list is inset like the tree is, so the same row sits at the same distance from the
    // panel edge in both; only a grid of cards needs room to breathe.
    <div ref={scroller} className={cn('h-full overflow-auto', grid ? 'p-2' : 'p-1')}>
      {items.length === 0 ? (
        empty
      ) : (
        <div
          role={roles.list}
          aria-label={label}
          aria-multiselectable={roles.list === 'listbox' ? multiple === true : undefined}
          style={{ height: virtualizer.getTotalSize() }}
          className="relative"
        >
          {virtualRows.map(row => {
            const slice = items.slice(row.index * columns, (row.index + 1) * columns)

            return (
              <div
                key={row.key}
                // The virtualizer's row is geometry, not structure: a generic element between a
                // `listbox` and its `option`s breaks the ownership ARIA requires.
                role="presentation"
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
                {slice.map((item, column) => {
                  const index = row.index * columns + column
                  return (
                    <CollectionCell
                      key={item.id}
                      index={index}
                      selected={selected.has(item.id)}
                      tabbable={index === tabStop}
                      // A list row spans the collection; a card is sized by its grid column.
                      className={grid ? undefined : 'h-full w-full'}
                      role={roles.cell}
                      // The virtualizer mounts a window, so the cells cannot be counted from the
                      // tree: without these a reader announces "1 of 35" over a list of 2000.
                      position={index + 1}
                      total={items.length}
                      onSelect={onSelect ? modifiers => pick(item, modifiers) : undefined}
                      onActivate={onActivate ? () => onActivate(item) : undefined}
                      onArrow={event => onCellKeyDown(index, event)}
                    >
                      {card ? card(item) : renderRow(item)}
                    </CollectionCell>
                  )
                })}
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
  /** Position in `items`, so the arrows can name the cell they want focused. */
  index: number
  selected: boolean
  /** The collection's single tab stop. Every other cell is reached with the arrows. */
  tabbable: boolean
  /** What this cell is in its container's terms — `rolesFor` decides the pair. */
  role?: 'option' | 'listitem'
  /** Where it sits in the whole collection, which the mounted window cannot say. */
  position: number
  total: number
  onSelect?: (modifiers: Modifiers) => void
  onActivate?: () => void
  onArrow: (event: KeyboardEvent) => void
  className?: string
  children: ReactNode
}

/**
 * Selection, activation and keyboard reach belong to the collection, not to the cards: a caller
 * that had to wire them itself would wire them differently in each panel.
 */
function CollectionCell({
  index,
  selected,
  tabbable,
  role,
  position,
  total,
  onSelect,
  onActivate,
  onArrow,
  className,
  children,
}: CollectionCellProps) {
  /**
   * Hover and selection are painted here rather than by the rendered item: a background set
   * inside the cell would sit on top of this one and swallow it on hover. The three states come
   * from `rowSkin`, which the tree draws its own rows with — the same line must not light up
   * differently depending on which panel it is listed in.
   */
  const skin = cn('min-w-0', rowSkin(selected), className)

  // What the cell answers to is not what puts it in reach: a row that only opens is walked to
  // and pressed like one that only selects.
  if (!onSelect && !onActivate) return <div className={skin}>{children}</div>

  return (
    <div
      role={role}
      aria-posinset={position}
      aria-setsize={total}
      data-cell={index}
      tabIndex={tabbable ? 0 : -1}
      // An option has a selected state; a listitem has none. The explorer paints what is OPEN
      // through the same prop, and announcing that as "selected" would describe a state its
      // rows can neither take nor give up.
      aria-selected={role === 'option' ? selected : undefined}
      onClick={onSelect}
      onDoubleClick={onActivate}
      onKeyDown={event => {
        if (event.key !== 'Enter' && event.key !== ' ') return onArrow(event.nativeEvent)

        // Only when the cell itself holds the focus: a control inside the row — the visibility
        // eye — answers the key on its own, and `VisibilityToggle` can stop a click but never
        // a key press. Without this, reaching the eye by keyboard also moved the selection.
        if (event.target !== event.currentTarget) return

        // Enter opens, Space picks. A row that cannot be picked leaves Space to the browser,
        // which scrolls the list: Space moves a selection everywhere else in the studio, and
        // making it open a document — switching workspace with it — is not what it promises.
        if (event.key === 'Enter' && onActivate) {
          event.preventDefault()
          onActivate()
        } else if (onSelect) {
          event.preventDefault()
          onSelect(event)
        }
      }}
      className={cn(skin, 'cursor-pointer')}
    >
      {children}
    </div>
  )
}

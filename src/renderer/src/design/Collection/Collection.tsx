import { useVirtualizer } from '@tanstack/react-virtual'
import { Fragment, useEffect, useRef, type DragEvent, type ReactNode } from 'react'
import { cn } from '@/helpers/cn'
import { offerBlankDrop, type DragLike } from '@/helpers/drag'
import { LIST_ONLY, type CollectionState } from '@/helpers/collectionState'
import { pickFrom, type Modifiers, type SelectionMode } from '@/helpers/selection'
import { useGrid } from '@/hooks/useGrid'
import { useReachEnd } from '@/hooks/useReachEnd'
import { useRemeasure } from '@/hooks/useRemeasure'
import { useRowHeight, type RowHeight } from '@/hooks/useRowHeight'
import { RowChevron } from '../RowChevron'
import { rowDrag } from '../rowDrag'
import { CollectionCell } from './CollectionCell'
import { focusVirtualCell, GAP, PREFETCH_ROWS } from '../virtual'

/** Breathing room between list rows. Rows that touch read as one block rather than a list. */
const ROW_GAP = 4

/**
 * Whether a gesture landed on the blank rather than on a card — anything that is not IN one.
 *
 * `Tree` asks `target === currentTarget` instead, and may: its rows span the width, so there is no
 * in-between. A grid has three — the gutters, the empty columns of a short last row, and the box
 * the virtualizer sizes to its content — and each of them is a place a user right-clicks.
 */
function onBlank(event: { target: EventTarget | null }): boolean {
  if (!(event.target instanceof Element)) return false
  // The detail of an open row is drawn BESIDE its cell, so `[data-cell]` alone read a press
  // inside it as a press on the empty area — and the callers that clear the selection there,
  // raise the root menu or take a foreign drop would all have answered it.
  return event.target.closest('[data-cell],[data-row-detail]') === null
}

export type CollectionProps<T extends { id: string }> = {
  items: readonly T[]
  /** Absent for a panel with no collection bar: a plain virtualized list, never a grid. */
  state?: CollectionState
  /**
   * Absent keeps the collection in list mode whatever `state.view` says: a panel with no
   * thumbnails has no card to draw, and inventing one so it is never called is noise.
   */
  renderCard?: (item: T) => ReactNode
  /**
   * Absent for a collection that is only ever a grid — the home's shelves of pictures, whose
   * state is a module constant with no bar to change it. A row written for a view nobody can
   * reach is a second rendering of the item that no eye ever checks.
   */
  renderRow?: (item: T) => ReactNode
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
  /**
   * What a right-click on a row offers. The item is handed over rather than a pointer: this
   * studio's menus are the system's own — `showContextMenu` — and the system pops them where
   * the pointer is, so nothing here has to know about coordinates.
   */
  onContextMenu?: (item: T) => void
  /**
   * Opening on a SINGLE click, for a list whose row leads somewhere instead of being picked —
   * the projects shelf, whose row opens the project it names.
   *
   * Not `onSelect` with the opening wired into it: that announces a `listbox` whose every row
   * carries `aria-selected="false"` for ever, since nothing here is ever selected. Not
   * `onActivate` either, which is the double-click. A list that opens is a `list`.
   */
  onOpen?: (item: T) => void
  /** Called as the end nears. Must tolerate being called again before it has answered. */
  onReachEnd?: () => void
  /** The items currently on screen, for whatever a card needs fetched only when it is seen. */
  onVisible?: (items: readonly T[]) => void
  /**
   * Which items cannot be picked, and stay listed anyway — a model the account's plan refuses.
   *
   * The row keeps its place in the tab order and its pointer events: it is `aria-disabled`, not
   * `disabled`. A cell removed from reach is a cell whose tooltip nobody can read, and the
   * tooltip is the only thing on screen that says WHY the row is refused.
   */
  isDisabled?: (item: T) => boolean
  /**
   * What a row opens onto, drawn UNDER it and inside the list — the shelf reads the asset it has
   * picked out this way. Passing it puts a chevron in front of every row and makes the list
   * MEASURE its rows instead of holding them all to one gauge.
   *
   * List view only: a grid has no room under a card, and cards are square by construction.
   */
  renderRowDetail?: (item: T) => ReactNode
  /** Which row is open, or `null`. One at a time — two open rows is a panel one scrolls twice. */
  expandedId?: string | null
  /**
   * Which rows have anything to open. A row that answers `false` keeps the column and draws no
   * twist in it: a chevron on a line that opens onto nothing is a promise the list cannot keep.
   */
  canOpen?: (item: T) => boolean
  /** The chevron was pressed. The caller holds `expandedId`, as it holds `selectedIds`. */
  onToggleRow?: (item: T) => void
  /** Shown in place of the items — the caller decides whether it means empty or unmatched. */
  empty?: ReactNode
  footer?: ReactNode
  /**
   * How tall a list row is — a SHAPE by preference, a number only for what no gauge describes.
   *
   * Resolved by `useRowHeight`, which reads the gauge the stylesheet already applies.
   */
  rowHeight?: RowHeight
  /**
   * A batch released on the blank BESIDE the cards — the place the collection is showing, there
   * being no card standing for it to aim at. `Tree` offers the same three on its own blank.
   */
  onDropRoot?: (ids: readonly string[]) => void
  /**
   * A drag that did NOT start in this collection, released on that same blank — the asset
   * shelf's, for the Explorer's grid. `Tree` takes the same object for its own blank, so the
   * two views of one folder answer the gesture alike.
   */
  foreign?: {
    carries: (event: DragLike) => boolean
    onDrop: (event: DragEvent<HTMLElement>) => void
  }
  /** A right-click on that blank. Raised after `onPressRoot`, never instead of it. */
  onContextMenuRoot?: () => void
  /**
   * A press on that blank, read as picking nothing. A prop of its own where `Tree` clears the
   * selection itself: `onSelect` here is told which ITEM was picked, so it cannot say "none".
   */
  onPressRoot?: () => void
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
  onContextMenu,
  onOpen,
  onReachEnd,
  onVisible,
  isDisabled,
  renderRowDetail,
  expandedId,
  canOpen,
  onToggleRow,
  empty,
  footer,
  rowHeight = 'control',
  onDropRoot,
  foreign,
  onContextMenuRoot,
  onPressRoot,
}: CollectionProps<T>) {
  const scroller = useRef<HTMLDivElement>(null)
  // Kept as the narrowed function rather than a boolean, so the cell below needs no second guard.
  // "No row to draw ⇒ always a grid", which is what the prop's own doc claims. Structural rather
  // than documented: a caller passing only `renderCard` under a `view: 'list'` state would
  // otherwise mount focusable, arrow-walkable cells that paint nothing — a blank list, not an error.
  const card = renderRow === undefined || state.view === 'grid' ? renderCard : undefined
  const grid = card !== undefined
  const fitting = useGrid(scroller, state.thumbnailSize, grid)

  // Read back from the gauge the rows are sized by, like `Tree` does: a constant is only right
  // at one density.
  const rowPixels = useRowHeight(rowHeight)

  const roles = rolesFor(onSelect !== undefined, onActivate !== undefined || onOpen !== undefined)
  const columns = grid ? fitting.columns : 1
  const rows = Math.ceil(items.length / columns)
  /**
   * A card is its column, square — the collection makes no guess about what the caller draws
   * inside it. The gap is part of the row the virtualizer reserves, and given back as padding
   * below the cell: a margin would be swallowed by the absolute positioning of each row.
   */
  const size = grid ? fitting.columnWidth + GAP : rowPixels + ROW_GAP

  // A grid has no room under a card, so the two never combine.
  const openable = renderRowDetail !== undefined && !grid

  const virtualizer = useVirtualizer({
    count: rows,
    getScrollElement: () => scroller.current,
    // The height of a CLOSED row: the answer where every row is one gauge tall, an estimate
    // where a row can open and the element is measured instead.
    estimateSize: () => size,
    overscan: grid ? 2 : 8,
  })

  useRemeasure(virtualizer, size)

  const virtualRows = virtualizer.getVirtualItems()
  const lastRow = virtualRows.at(-1)?.index ?? 0
  useReachEnd({ last: lastRow, count: rows, ahead: PREFETCH_ROWS }, onReachEnd)

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
  // The anchor is a notion of selection, so a collection that only opens its rows has none and
  // enters at the first mounted cell instead.
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

  const focusCell = (index: number): void =>
    focusVirtualCell(index, {
      scroller: scroller.current,
      scrollToIndex: row => virtualizer.scrollToIndex(row),
      count: items.length,
      attribute: 'data-cell',
      columns,
    })

  const onCellKeyDown = (index: number, event: KeyboardEvent): void => {
    if (event.key === 'ArrowRight') focusCell(index + 1)
    else if (event.key === 'ArrowLeft') focusCell(index - 1)
    else if (event.key === 'ArrowDown') focusCell(index + columns)
    else if (event.key === 'ArrowUp') focusCell(index - columns)
    else return

    event.preventDefault()
  }

  return (
    // A list is inset like the tree is, so the same row sits at the same distance from the panel
    // edge in both — `Tree` carries the same step, and moving one without the other is what makes
    // two lists of the same studio sit at two distances from the same edge.
    <div
      ref={scroller}
      className="h-full overflow-auto p-2"
      // The secondary button belongs to `onContextMenu`: on macOS it arrives as Ctrl+click.
      onPointerDown={event => {
        if (event.button !== 2 && onBlank(event)) onPressRoot?.()
      }}
      onContextMenu={event => {
        if (!onContextMenuRoot || !onBlank(event)) return
        event.preventDefault()
        onPressRoot?.()
        onContextMenuRoot()
      }}
      onDragOver={event => {
        if (!onBlank(event)) return
        offerBlankDrop(event, {
          copies: foreign?.carries(event) ?? false,
          moves: onDropRoot !== undefined && rowDrag.carries(event),
        })
      }}
      onDrop={event => {
        if (!onBlank(event)) return
        if (foreign?.carries(event)) {
          event.preventDefault()
          return foreign.onDrop(event)
        }
        if (!onDropRoot) return
        event.preventDefault()
        const carried = rowDrag.idsFrom(event)
        if (carried.length > 0) onDropRoot(carried)
      }}
    >
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
                //
                // 🛑 Where a row opens, its detail is drawn HERE — beside the cell rather than
                // inside it, an `option` being no place for a control. The listbox then owns one
                // child that is not an option. Written down rather than hidden, and not measured
                // against a screen reader.
                role="presentation"
                data-index={row.index}
                // Measured only where a row can open: elsewhere the gauge is the answer, and a
                // measurer would read the DOM back on every frame for nothing.
                ref={openable ? virtualizer.measureElement : undefined}
                style={{
                  transform: `translateY(${row.start}px)`,
                  // What `Row` sizes its picture against: the line it actually stands in, so no
                  // row shape has to be guessed from the props a caller passed.
                  ['--sc-row-height' as string]: `${rowPixels}px`,
                  // Left to the content where a row can open — a stated height is exactly what
                  // the measurer would read back, and every row would stay one gauge tall.
                  ...(openable ? {} : { height: row.size }),
                  ...(grid
                    ? { gap: GAP, gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }
                    : { paddingBottom: ROW_GAP }),
                }}
                className={cn(
                  'absolute inset-x-0 top-0 box-border',
                  grid ? 'grid items-start' : openable ? 'flex flex-col' : 'flex',
                )}
              >
                {slice.map((item, column) => {
                  const index = row.index * columns + column
                  const open = openable && item.id === expandedId && (canOpen?.(item) ?? true)
                  const cell = (
                    <CollectionCell
                      key={item.id}
                      expanded={openable && (canOpen?.(item) ?? true) ? open : undefined}
                      index={index}
                      selected={selected.has(item.id)}
                      disabled={isDisabled?.(item) === true}
                      tabbable={index === tabStop}
                      // A list row spans the collection; a card is sized by its grid column, and
                      // is inset so the selection this cell paints has somewhere to show. A card
                      // is an opaque tile of exactly the cell's size: flush, it covered
                      // `bg-accent-soft` to the last pixel and three picked assets looked like
                      // every other. The inset is constant, so nothing moves on being picked.
                      // Two insets, two jobs: a CARD's keeps an opaque tile off the selection
                      // painted under it, so nothing moves on being picked; a ROW's is the
                      // distance this cell owes its content from the fill it draws, which is
                      // why it lives here rather than in `Row` — as the tree's row already does.
                      className={
                        grid
                          ? 'p-1'
                          : // 🛑 `flex items-center` where the cell holds a chevron: without it
                            // the twist and the row stack, and every line of the shelf drew its
                            // glyph ABOVE its own name, at twice the height. The tree gets the
                            // same from the line shape its own row wears.
                            cn('h-full w-full px-1', openable && 'flex items-center')
                      }
                      role={roles.cell}
                      // The virtualizer mounts a window, so the cells cannot be counted from the
                      // tree: without these a reader announces "1 of 35" over a list of 2000.
                      position={index + 1}
                      total={items.length}
                      // `onOpen` rides the click slot: it IS the single click, and the two are
                      // mutually exclusive by construction — a row that opens is not one to pick.
                      onSelect={
                        onSelect
                          ? modifiers => pick(item, modifiers)
                          : onOpen && (() => onOpen(item))
                      }
                      onActivate={onActivate ? () => onActivate(item) : undefined}
                      onContextMenu={onContextMenu ? () => onContextMenu(item) : undefined}
                      onArrow={event => onCellKeyDown(index, event)}
                    >
                      {openable && (
                        <RowChevron
                          expandable={canOpen?.(item) ?? true}
                          expanded={open}
                          onToggle={() => onToggleRow?.(item)}
                        />
                      )}
                      {card ? card(item) : renderRow?.(item)}
                    </CollectionCell>
                  )

                  if (!openable) return cell

                  return (
                    <Fragment key={item.id}>
                      {/* The row keeps the gauge; only what opens under it is free to be tall. */}
                      <div style={{ height: rowPixels }} className="flex shrink-0">
                        {cell}
                      </div>
                      {open && <div data-row-detail>{renderRowDetail?.(item)}</div>}
                    </Fragment>
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

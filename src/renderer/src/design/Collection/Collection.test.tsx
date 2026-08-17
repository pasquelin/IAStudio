import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Collection, type CollectionProps } from './Collection'
import { refreshPalette } from '@/engines/core/palette'
import { DEFAULT_COLLECTION_STATE, type CollectionState } from '@/helpers/collection-state'

type Row = { id: string; name: string }

function rows(count: number): Row[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `row_${index}`,
    name: `Row ${index}`,
  }))
}

function renderCollection(
  items: Row[],
  overrides: Partial<CollectionState> = {},
  props: Partial<CollectionProps<Row>> = {},
) {
  return render(
    <Collection
      label="Rows"
      items={items}
      state={{ ...DEFAULT_COLLECTION_STATE, ...overrides }}
      renderCard={item => <span>{item.name}</span>}
      renderRow={item => <span>{item.name}</span>}
      {...props}
    />,
  )
}

describe('Collection', () => {
  it('renders a window over the items rather than all of them', () => {
    renderCollection(rows(2000))

    const rendered = screen.getAllByText(/^Row \d+$/)
    expect(rendered.length).toBeGreaterThan(0)
    expect(rendered.length).toBeLessThan(200)
    expect(screen.getByText('Row 0')).toBeInTheDocument()
  })

  it('virtualizes the list view too', () => {
    renderCollection(rows(2000), { view: 'list' })

    expect(screen.getAllByText(/^Row \d+$/).length).toBeLessThan(200)
  })

  // A panel with no thumbnails would otherwise show a grid of empty squares.
  it('stays a list when no card renderer is given, whatever the state says', () => {
    render(
      <Collection
        label="Rows"
        items={rows(3)}
        state={{ ...DEFAULT_COLLECTION_STATE, view: 'grid' }}
        renderRow={item => <span>row {item.name}</span>}
      />,
    )

    expect(screen.getByText('row Row 0')).toBeInTheDocument()
  })

  /**
   * The selection is painted on the cell, and a card is an opaque tile of exactly the cell's
   * size: flush, it covered `bg-accent-soft` to the last pixel. The shelf said "3 items" over
   * three squares indistinguishable from the rest — while the same selection read perfectly in
   * list view, where nothing sits on top of the row.
   */
  it('insets a card so the selection painted under it is not covered', () => {
    renderCollection(rows(4), {}, { onSelect: vi.fn(), selectedIds: ['row_0'] })

    const cell = screen.getByText('Row 0').closest('[data-cell]')

    expect(cell).toHaveClass('bg-accent-soft')
    expect(cell).toHaveClass('p-1')
  })

  it('leaves a list row flush, where nothing is drawn over it', () => {
    renderCollection(rows(4), { view: 'list' }, { onSelect: vi.fn(), selectedIds: ['row_0'] })

    const cell = screen.getByText('Row 0').closest('[data-cell]')

    expect(cell).toHaveClass('bg-accent-soft')
    expect(cell).not.toHaveClass('p-1')
  })

  it('lays out more columns as the thumbnails shrink', () => {
    const { rerender } = renderCollection(rows(500), { thumbnailSize: 200 })
    const wide = screen.getAllByText(/^Row \d+$/).length

    rerender(
      <Collection
        label="Rows"
        items={rows(500)}
        state={{ ...DEFAULT_COLLECTION_STATE, thumbnailSize: 64 }}
        renderCard={item => <span>{item.name}</span>}
        renderRow={item => <span>{item.name}</span>}
      />,
    )

    expect(screen.getAllByText(/^Row \d+$/).length).toBeGreaterThan(wide)
  })

  it('shows the empty node in place of the items, and only then', () => {
    renderCollection([], {}, { empty: <p>Nothing here</p> })
    expect(screen.getByText('Nothing here')).toBeInTheDocument()

    renderCollection(rows(4), {}, { empty: <p>Still nothing</p> })
    expect(screen.queryByText('Still nothing')).not.toBeInTheDocument()
  })

  // The end is announced before it is reached, so the next page lands before the gap shows.
  it('asks for more as the end nears', async () => {
    const onReachEnd = vi.fn()
    renderCollection(rows(6), {}, { onReachEnd })

    await waitFor(() => expect(onReachEnd).toHaveBeenCalled())
  })

  // Asking for more with nothing on screen loops until the source runs dry.
  it('does not ask for more when it has nothing to show', () => {
    const onReachEnd = vi.fn()
    renderCollection([], {}, { onReachEnd })

    expect(onReachEnd).not.toHaveBeenCalled()
  })

  it('does not ask for more while the end is far below', () => {
    const onReachEnd = vi.fn()
    renderCollection(rows(4000), {}, { onReachEnd })

    expect(onReachEnd).not.toHaveBeenCalled()
  })

  it('reports the items on screen, not the whole collection', async () => {
    const onVisible = vi.fn()
    renderCollection(rows(2000), {}, { onVisible })

    await waitFor(() => expect(onVisible).toHaveBeenCalled())
    const reported = onVisible.mock.calls.at(-1)?.[0] ?? []

    expect(reported[0]).toEqual({ id: 'row_0', name: 'Row 0' })
    expect(reported.length).toBeLessThan(200)
  })

  it('selects on click and marks the selected item', async () => {
    const onSelect = vi.fn()
    renderCollection(rows(4), {}, { onSelect, selectedIds: ['row_1'] })

    await userEvent.click(screen.getByText('Row 2'))

    expect(onSelect).toHaveBeenCalledWith({ id: 'row_2', name: 'Row 2' }, ['row_2'], 'replace')
    expect(screen.getByText('Row 1').closest('[role="option"]')).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('selects with the keyboard, so the collection is reachable without a mouse', async () => {
    const onSelect = vi.fn()
    renderCollection(rows(4), {}, { onSelect })

    await userEvent.tab()
    await userEvent.keyboard('{Enter}')

    expect(onSelect).toHaveBeenCalledWith({ id: 'row_0', name: 'Row 0' }, ['row_0'], 'replace')
  })

  // The same gesture the tree offers, so a row behaves alike whichever panel lists it.
  it('extends over the items between the anchor and a shift-clicked one', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    renderCollection(rows(4), {}, { onSelect, selectedIds: ['row_0'] })

    await user.keyboard('{Shift>}')
    await user.click(screen.getByText('Row 2'))
    await user.keyboard('{/Shift}')

    expect(onSelect.mock.calls[0]?.slice(1)).toEqual([['row_0', 'row_1', 'row_2'], 'replace'])
  })

  it('paints every selected item, not only the anchor', () => {
    renderCollection(rows(4), {}, { onSelect: vi.fn(), selectedIds: ['row_0', 'row_2'] })

    const selected = screen
      .getAllByRole('option')
      .filter(cell => cell.getAttribute('aria-selected') === 'true')
    expect(selected).toHaveLength(2)
  })

  // The eye of a layer or a node sits inside the row and answers Enter itself. Selecting on top
  // of it is the keyboard version of the click theft `VisibilityToggle` was written to stop.
  it('leaves the row alone when a control inside it takes the key', async () => {
    const onSelect = vi.fn()
    const onActivate = vi.fn()
    const onToggle = vi.fn()
    renderCollection(
      rows(4),
      { view: 'list' },
      {
        onSelect,
        onActivate,
        // Stops the click the way `VisibilityToggle` does — the key press is the part the cell
        // has to handle, since stopping a click never reaches it.
        renderRow: (row: Row) => (
          <span>
            {row.name}
            <button
              onClick={event => {
                event.stopPropagation()
                onToggle()
              }}
            >
              eye
            </button>
          </span>
        ),
      },
    )

    screen.getAllByRole('button', { name: 'eye' })[1]?.focus()
    await userEvent.keyboard('{Enter}')

    expect(onToggle).toHaveBeenCalled()
    expect(onSelect).not.toHaveBeenCalled()
    expect(onActivate).not.toHaveBeenCalled()
  })

  /**
   * `option` on its own is invalid ARIA: without a `listbox` around it, a screen reader
   * announces neither the list nor "3 of 12", and some engines drop the role entirely.
   */
  it('wraps its cells in a listbox, so a reader can count them', () => {
    renderCollection(rows(4), { view: 'list' }, { onSelect: vi.fn() })

    const listbox = screen.getByRole('listbox')
    expect(listbox).toBeInTheDocument()
    expect(screen.getAllByRole('option')[0]?.closest('[role="listbox"]')).toBe(listbox)
  })

  // A shelf whose rows are only opened selects nothing: saying "selected" of a row the user
  // cannot pick describes a state they can neither set nor clear.
  it('is a plain list when its rows can only be opened', () => {
    renderCollection(rows(4), { view: 'list' }, { onActivate: vi.fn() })

    expect(screen.getByRole('list')).toBeInTheDocument()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.getAllByRole('listitem')[0]).not.toHaveAttribute('aria-selected')
  })

  /**
   * Opening on a single click is still opening. Wired through `onSelect` for want of anything
   * else, it announced a `listbox` whose rows are never selected.
   */
  describe('a list whose rows open on a single click', () => {
    it('stays a list rather than becoming a listbox', () => {
      renderCollection(rows(4), { view: 'list' }, { onOpen: vi.fn() })

      expect(screen.getByRole('list')).toBeInTheDocument()
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
      expect(screen.getAllByRole('listitem')[0]).not.toHaveAttribute('aria-selected')
    })

    it('opens the row that was clicked, once', async () => {
      const onOpen = vi.fn()
      renderCollection(rows(4), { view: 'list' }, { onOpen })

      await userEvent.click(screen.getByText('Row 1'))

      expect(onOpen).toHaveBeenCalledTimes(1)
      expect(onOpen.mock.calls[0]?.[0]).toMatchObject({ name: 'Row 1' })
    })

    it('opens from the keyboard too, which is what a wired-up click would have lost', async () => {
      const onOpen = vi.fn()
      renderCollection(rows(4), { view: 'list' }, { onOpen })

      await userEvent.tab()
      await userEvent.keyboard('{Enter}')

      expect(onOpen).toHaveBeenCalledTimes(1)
    })
  })

  // A `listbox` is a widget, and an unnamed widget is announced as the bare word "listbox" —
  // the same word in each of the six panels that draw one.
  it('names the list it draws', () => {
    renderCollection(rows(4), { view: 'list' }, { onSelect: vi.fn() })

    expect(screen.getByRole('listbox', { name: 'Rows' })).toBeInTheDocument()
  })

  // `aria-multiselectable` defaults to false, which promises at most one selected row. Three of
  // the six panels keep a single id, so the answer belongs to the caller.
  it('says whether picking one row keeps the others', () => {
    renderCollection(rows(4), { view: 'list' }, { onSelect: vi.fn(), multiple: true })
    expect(screen.getByRole('listbox')).toHaveAttribute('aria-multiselectable', 'true')

    renderCollection(rows(4), { view: 'list' }, { onSelect: vi.fn() })
    expect(screen.getAllByRole('listbox')[1]).toHaveAttribute('aria-multiselectable', 'false')
  })

  // The virtualizer mounts a window of about thirty rows: counted from the tree alone, a
  // catalogue of two thousand models announces itself as a list of thirty.
  it('says how many items there are, not how many are mounted', () => {
    renderCollection(rows(2000), { view: 'list' }, { onSelect: vi.fn() })

    const first = screen.getAllByRole('option')[0]
    expect(first).toHaveAttribute('aria-setsize', '2000')
    expect(first).toHaveAttribute('aria-posinset', '1')
  })

  it('names no list at all when its cells answer to nothing', () => {
    renderCollection(rows(4), { view: 'list' })

    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('leaves cells out of the tab order when nothing can be selected nor activated', () => {
    renderCollection(rows(4))

    expect(screen.queryByRole('option')).not.toBeInTheDocument()
  })

  // A panel whose rows are opened rather than selected — the explorer — is reached the same
  // way as one whose rows are picked: what a cell answers to is not what puts it in reach.
  it('keeps a cell reachable when it can only be activated', () => {
    renderCollection(rows(4), { view: 'list' }, { onActivate: vi.fn() })

    expect(screen.getAllByRole('listitem').some(cell => cell.tabIndex === 0)).toBe(true)
  })

  // The virtualizer only mounts a window: an anchor scrolled far out of it used to take the tab
  // stop with it, and the whole collection fell out of the tab order.
  it('keeps its tab stop when the anchor is nowhere near the mounted window', () => {
    renderCollection(rows(500), { view: 'list' }, { onSelect: vi.fn(), selectedIds: ['row_400'] })

    expect(screen.getAllByRole('option').some(cell => cell.tabIndex === 0)).toBe(true)
  })

  // Space scrolls a focused list, and picks rows everywhere else in the studio. A panel that
  // only opens its rows must not turn it into "open", which can switch workspace.
  it('leaves Space alone on a row it can only open', async () => {
    const onActivate = vi.fn()
    renderCollection(rows(4), { view: 'list' }, { onActivate })

    await userEvent.tab()
    await userEvent.keyboard(' ')

    expect(onActivate).not.toHaveBeenCalled()
  })

  it('walks the cells with the arrows and activates on Enter, without a mouse', async () => {
    const onActivate = vi.fn()
    renderCollection(rows(4), { view: 'list' }, { onActivate })

    await userEvent.tab()
    await userEvent.keyboard('{ArrowDown}')
    await userEvent.keyboard('{Enter}')

    expect(onActivate).toHaveBeenCalledWith({ id: 'row_1', name: 'Row 1' })
  })

  it('activates on a double-click, so the caller stops wiring one of its own', async () => {
    const onActivate = vi.fn()
    renderCollection(rows(4), { view: 'list' }, { onActivate })

    await userEvent.dblClick(screen.getByText('Row 2'))

    expect(onActivate).toHaveBeenCalledWith({ id: 'row_2', name: 'Row 2' })
  })

  // Enter opens and Space picks, the way a file browser answers both: a collection that can do
  // the two must not make the opening gesture also move the selection.
  it('opens on Enter and selects on Space when it can do both', async () => {
    const onActivate = vi.fn()
    const onSelect = vi.fn()
    renderCollection(rows(4), { view: 'list' }, { onActivate, onSelect })

    await userEvent.tab()
    await userEvent.keyboard('{Enter}')
    expect(onActivate).toHaveBeenCalledWith({ id: 'row_0', name: 'Row 0' })
    expect(onSelect).not.toHaveBeenCalled()

    await userEvent.keyboard(' ')
    expect(onSelect).toHaveBeenCalledWith({ id: 'row_0', name: 'Row 0' }, ['row_0'], 'replace')
  })

  // A cell per tab makes a catalogue of five hundred models five hundred presses deep.
  it('offers a single tab stop, whatever the collection holds', () => {
    renderCollection(rows(200), { view: 'list' }, { onSelect: vi.fn() })

    const reachable = screen.getAllByRole('option').filter(cell => cell.tabIndex === 0)
    expect(reachable).toHaveLength(1)
  })

  it('puts that tab stop on the selected item, so tab lands where the eye is', () => {
    renderCollection(rows(20), { view: 'list' }, { onSelect: vi.fn(), selectedIds: ['row_3'] })

    const reachable = screen.getAllByRole('option').find(cell => cell.tabIndex === 0)
    expect(reachable).toHaveTextContent('Row 3')
  })

  it('walks the cells with the arrows, since only one of them takes a tab', async () => {
    renderCollection(rows(20), { view: 'list' }, { onSelect: vi.fn() })

    await userEvent.tab()
    await userEvent.keyboard('{ArrowDown}')

    expect(screen.getByText('Row 1').closest('[role="option"]')).toHaveFocus()

    await userEvent.keyboard('{ArrowUp}')
    expect(screen.getByText('Row 0').closest('[role="option"]')).toHaveFocus()
  })

  it('moves one card sideways and a whole row down, in a grid', async () => {
    renderCollection(rows(40), { view: 'grid' }, { onSelect: vi.fn() })

    await userEvent.tab()
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByText('Row 1').closest('[role="option"]')).toHaveFocus()

    // A row down lands a full row further, whatever width jsdom decided to measure.
    const before = document.activeElement?.getAttribute('data-cell')
    await userEvent.keyboard('{ArrowDown}')
    const after = document.activeElement?.getAttribute('data-cell')
    expect(Number(after) - Number(before)).toBeGreaterThan(1)
  })

  it('stops at the edges rather than wrapping around', async () => {
    renderCollection(rows(5), { view: 'list' }, { onSelect: vi.fn() })

    await userEvent.tab()
    await userEvent.keyboard('{ArrowUp}')

    expect(screen.getByText('Row 0').closest('[role="option"]')).toHaveFocus()
  })

  /** The other way along a row of cards — the one direction the walk had never been asked for. */
  it('moves one card back with the left arrow', async () => {
    renderCollection(rows(40), { view: 'grid' }, { onSelect: vi.fn() })

    await userEvent.tab()
    await userEvent.keyboard('{ArrowRight}{ArrowLeft}')

    expect(screen.getByText('Row 0').closest('[role="option"]')).toHaveFocus()
  })

  /**
   * A key that is not an arrow is nobody's business here: swallowing it would take type-ahead
   * and every shortcut away from a focused row.
   */
  it('leaves a key that is not an arrow alone', async () => {
    renderCollection(rows(5), { view: 'list' }, { onSelect: vi.fn() })

    await userEvent.tab()
    const focused = document.activeElement
    await userEvent.keyboard('a')

    expect(document.activeElement).toBe(focused)
  })

  /**
   * A refused row stays listed, reachable and announced — it is `aria-disabled`, not removed.
   * A cell taken out of reach is a cell whose tooltip nobody can read, and that tooltip is
   * usually the only thing on screen saying why the row is refused.
   */
  describe('a refused item', () => {
    const refuseFirst = (props: Partial<CollectionProps<Row>> = {}) =>
      renderCollection(
        rows(5),
        { view: 'list' },
        { isDisabled: item => item.id === 'row_0', ...props },
      )

    const cellOf = (name: string): HTMLElement | null =>
      screen.getByText(name).closest('[role="option"]')

    it('is announced as disabled, and its neighbours are not', () => {
      refuseFirst({ onSelect: vi.fn() })

      expect(cellOf('Row 0')).toHaveAttribute('aria-disabled', 'true')
      expect(cellOf('Row 1')).not.toHaveAttribute('aria-disabled')
    })

    it('is not selected by a click', async () => {
      const onSelect = vi.fn()
      refuseFirst({ onSelect })

      await userEvent.click(screen.getByText('Row 0'))

      expect(onSelect).not.toHaveBeenCalled()
    })

    it('is not opened by a double click', async () => {
      const onActivate = vi.fn()
      refuseFirst({ onSelect: vi.fn(), onActivate })

      await userEvent.dblClick(screen.getByText('Row 0'))

      expect(onActivate).not.toHaveBeenCalled()
    })

    it('is not selected by the keyboard either', async () => {
      const onSelect = vi.fn()
      refuseFirst({ onSelect })

      await userEvent.tab()
      await userEvent.keyboard(' ')

      expect(onSelect).not.toHaveBeenCalled()
    })

    // Stopping the arrows on it would strand the keyboard: the row keeps its place in the list.
    it('still lets the arrows walk through it', async () => {
      refuseFirst({ onSelect: vi.fn() })

      await userEvent.tab()
      expect(cellOf('Row 0')).toHaveFocus()

      await userEvent.keyboard('{ArrowDown}')
      await waitFor(() => expect(cellOf('Row 1')).toHaveFocus())
    })
  })
})

describe('Collection, the height it estimates', () => {
  afterEach(() => {
    document.documentElement.style.removeProperty('--sc-control')
    document.documentElement.style.removeProperty('--sc-row-stacked')
    refreshPalette()
  })

  const listOf = (count: number, props: Partial<CollectionProps<Row>> = {}) =>
    renderCollection(rows(count), { view: 'list' }, { onSelect: vi.fn(), ...props })

  /**
   * Each row reserves its height plus `ROW_GAP`. A constant estimate is only right at one
   * density: three compact rows at 24 are 84px, and estimating them at 28 reserves twelve
   * pixels nobody paints — the dead band this lot was opened for.
   */
  it('estimates the gauge its rows are drawn at, not a constant', () => {
    document.documentElement.style.setProperty('--sc-control', '24px')
    refreshPalette()

    listOf(3)

    expect(screen.getByRole('listbox')).toHaveStyle({ height: '84px' })
  })

  it('falls back to the shipped height when no gauge is declared', () => {
    listOf(3)

    expect(screen.getByRole('listbox')).toHaveStyle({ height: '96px' })
  })

  /**
   * A row stacking a name over a subtitle reads its own gauge. Two steps of `leading-tight` text
   * are 27.5px, so the control height leaves nothing at all — which is what the recent projects
   * panel showed, its rows touching each other.
   */
  it('gives a stacked row the taller gauge', () => {
    document.documentElement.style.setProperty('--sc-row-stacked', '32px')
    refreshPalette()

    listOf(3, { rowHeight: 'stacked' })

    expect(screen.getByRole('listbox')).toHaveStyle({ height: '108px' })
  })

  it('leaves a stacked row taller than a plain one at the same density', () => {
    listOf(3, { rowHeight: 'stacked' })

    // The shipped fallback, 36 + 4 of gap, three times — no gauge is declared under jsdom.
    expect(screen.getByRole('listbox')).toHaveStyle({ height: '120px' })
  })

  /**
   * The same two steps of text, in a row painted edge to edge: the fill takes off the room a bare
   * row keeps, so it asks for its own gauge. Kept apart from `stacked` because raising THAT one
   * for the home's filled rows loosened the explorer and the documents panel, which fill nothing.
   */
  it('leaves a filled row taller still, on a gauge of its own', () => {
    listOf(3, { rowHeight: 'filled' })

    expect(screen.getByRole('listbox')).toHaveStyle({ height: '144px' })
  })

  /** A number still passes through, for the picture rows no gauge describes. */
  it('takes a number for what no shape names', () => {
    listOf(3, { rowHeight: 40 })

    expect(screen.getByRole('listbox')).toHaveStyle({ height: '132px' })
  })

  /**
   * Switching density under a mounted list. The virtualizer memoizes on `count`, never on the
   * estimator, so without a re-measure the rows keep the height the density just left.
   */
  it('re-measures when the density changes under a mounted list', () => {
    document.documentElement.style.setProperty('--sc-control', '28px')
    refreshPalette()
    listOf(3)
    expect(screen.getByRole('listbox')).toHaveStyle({ height: '96px' })

    act(() => {
      document.documentElement.style.setProperty('--sc-control', '24px')
      refreshPalette()
    })

    expect(screen.getByRole('listbox')).toHaveStyle({ height: '84px' })
  })
})

/**
 * Found at the screen, on a real folder: a grid has blank the tree has not — the gutters, the empty
 * columns of a short last row, and the box the virtualizer sizes to its content. Asking
 * `target === currentTarget`, as the tree does, answered for none of them, and the one gesture that
 * makes a folder where the user is looking did nothing wherever it was likeliest to be tried.
 */
describe('Collection, the blank a grid has and a list has not', () => {
  it('raises the root menu from the row geometry beside a card', () => {
    const onContextMenuRoot = vi.fn()
    renderCollection(rows(3), { view: 'grid' }, { onSelect: vi.fn(), onContextMenuRoot })

    // The row, not the scroller: it spans the width, so it IS what lies beside a card.
    fireEvent.contextMenu(screen.getByText('Row 0').closest('[role="option"]')!.parentElement!)

    expect(onContextMenuRoot).toHaveBeenCalled()
  })

  it('raises it from the box the virtualizer sizes, which lies under every row', () => {
    const onContextMenuRoot = vi.fn()
    renderCollection(rows(3), { view: 'grid' }, { onSelect: vi.fn(), onContextMenuRoot })

    fireEvent.contextMenu(screen.getByRole('listbox'))

    expect(onContextMenuRoot).toHaveBeenCalled()
  })

  it('leaves a card alone, which is the whole point of asking', () => {
    const onContextMenuRoot = vi.fn()
    renderCollection(rows(3), { view: 'grid' }, { onSelect: vi.fn(), onContextMenuRoot })

    fireEvent.contextMenu(screen.getByText('Row 0'))

    expect(onContextMenuRoot).not.toHaveBeenCalled()
  })
})

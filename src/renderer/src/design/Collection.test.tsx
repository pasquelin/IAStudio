import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Collection, type CollectionProps } from './Collection'
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
        items={rows(3)}
        state={{ ...DEFAULT_COLLECTION_STATE, view: 'grid' }}
        renderRow={item => <span>row {item.name}</span>}
      />,
    )

    expect(screen.getByText('row Row 0')).toBeInTheDocument()
  })

  it('lays out more columns as the thumbnails shrink', () => {
    const { rerender } = renderCollection(rows(500), { thumbnailSize: 200 })
    const wide = screen.getAllByText(/^Row \d+$/).length

    rerender(
      <Collection
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

  it('leaves cells out of the tab order when nothing can be selected nor activated', () => {
    renderCollection(rows(4))

    expect(screen.queryByRole('option')).not.toBeInTheDocument()
  })

  // A panel whose rows are opened rather than selected — the explorer — is reached the same
  // way as one whose rows are picked: what a cell answers to is not what puts it in reach.
  it('keeps a cell reachable when it can only be activated', () => {
    renderCollection(rows(4), { view: 'list' }, { onActivate: vi.fn() })

    expect(screen.getAllByRole('option').some(cell => cell.tabIndex === 0)).toBe(true)
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
})

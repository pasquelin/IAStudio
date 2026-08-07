import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Collection } from './Collection'
import { DEFAULT_COLLECTION_STATE, type CollectionState } from '@/helpers/collection-state'

type Row = { id: string; name: string }

function rows(count: number): Row[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `row_${index}`,
    name: `Row ${index}`,
  }))
}

function renderCollection(items: Row[], overrides: Partial<CollectionState> = {}, props = {}) {
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
    renderCollection(rows(4), {}, { onSelect, selectedId: 'row_1' })

    await userEvent.click(screen.getByText('Row 2'))

    expect(onSelect).toHaveBeenCalledWith({ id: 'row_2', name: 'Row 2' })
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

    expect(onSelect).toHaveBeenCalledWith({ id: 'row_0', name: 'Row 0' })
  })

  it('leaves cells out of the tab order when nothing can be selected', () => {
    renderCollection(rows(4))

    expect(screen.queryByRole('option')).not.toBeInTheDocument()
  })

  // A cell per tab makes a catalogue of five hundred models five hundred presses deep.
  it('offers a single tab stop, whatever the collection holds', () => {
    renderCollection(rows(200), { view: 'list' }, { onSelect: vi.fn() })

    const reachable = screen.getAllByRole('option').filter(cell => cell.tabIndex === 0)
    expect(reachable).toHaveLength(1)
  })

  it('puts that tab stop on the selected item, so tab lands where the eye is', () => {
    renderCollection(rows(20), { view: 'list' }, { onSelect: vi.fn(), selectedId: 'row_3' })

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

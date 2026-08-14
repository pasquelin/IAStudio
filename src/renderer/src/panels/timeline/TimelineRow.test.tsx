import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TimelineRow, type RowReorder } from './TimelineRow'

const ROW_HEIGHT = 40
const GRIP = /Move the row/

describe('TimelineRow', () => {
  /** A stack that always takes the move, unless the test hands one that does not. */
  const rowWith = (reorder: Partial<RowReorder> & Pick<RowReorder, 'move'>) => (
    <TimelineRow height={ROW_HEIGHT} reorder={{ label: 'Move the row', ...reorder }}>
      <span>A1</span>
    </TimelineRow>
  )

  const grab = (): HTMLElement => {
    const grip = screen.getByRole('button', { name: GRIP })
    fireEvent.pointerDown(grip, { clientY: 0, pointerId: 1 })
    return grip
  }

  /**
   * Fired on the WINDOW, never on the grip — which is where the gesture listens, and that is the
   * whole point: a row travels through the DOM as the stack reorders under it, and a node that is
   * re-inserted drops the pointer capture it held. Bound to the element, the drag died on the
   * first rank it crossed.
   */
  const dragTo = (clientY: number): void => {
    fireEvent.pointerMove(window, { clientY, pointerId: 1 })
  }

  const drop = (): void => {
    fireEvent.pointerUp(window, { pointerId: 1 })
  }

  it('moves the row by what the drag has travelled, and only by the difference', () => {
    const move = vi.fn((by: number) => by)
    render(rowWith({ move }))

    grab()
    dragTo(45)
    dragTo(85)

    // One place, then one more — never "one, then two", which would send the row twice as far
    // as the pointer went.
    expect(move.mock.calls).toEqual([[1], [1]])
  })

  // The gesture the defect was reported against: a rank up, then back down. The row moved once
  // and the drag went dead, because moving it is what released the capture the grip relied on.
  it('keeps following the pointer after the row has moved, in both directions', () => {
    const move = vi.fn((by: number) => by)
    render(rowWith({ move }))

    grab()
    dragTo(-45)
    dragTo(0)
    dragTo(45)

    expect(move.mock.calls).toEqual([[-1], [1], [1]])
  })

  it('leaves the row where it is while the pointer stays inside its own height', () => {
    const move = vi.fn((by: number) => by)
    render(rowWith({ move }))

    grab()
    dragTo(15)

    expect(move).not.toHaveBeenCalled()
  })

  // Held against the end of the stack, a drag banks nothing: the row would otherwise climb a
  // place it was never dragged over, the moment the pointer came back to where it started.
  it('counts what the stack gave, not what the pointer asked for', () => {
    const move = vi.fn(() => 0)
    render(rowWith({ move }))

    grab()
    dragTo(45)
    dragTo(0)

    expect(move.mock.calls).toEqual([[1]])
  })

  it('moves the row from the keyboard, so reordering is not a mouse-only gesture', async () => {
    const move = vi.fn((by: number) => by)
    render(rowWith({ move }))

    screen.getByRole('button', { name: GRIP }).focus()
    await userEvent.keyboard('{ArrowUp}{ArrowDown}')

    expect(move.mock.calls).toEqual([[-1], [1]])
  })

  // A drag across three places is one thing the user did, and has to cost one ⌘Z wherever the
  // order of the stack is an edit.
  it('opens one gesture for a whole drag, and closes it on release', () => {
    const begin = vi.fn()
    const end = vi.fn()
    render(rowWith({ move: (by: number) => by, begin, end }))

    grab()
    dragTo(45)
    dragTo(85)
    expect(end).not.toHaveBeenCalled()

    drop()
    expect(begin).toHaveBeenCalledTimes(1)
    expect(end).toHaveBeenCalledTimes(1)
  })

  // A touch cancelled by the system, a window that loses the pointer: the gesture has to close,
  // or the stack stays armed and the next move reorders something nobody is holding.
  it('closes the gesture when the pointer is cancelled', () => {
    const move = vi.fn((by: number) => by)
    const end = vi.fn()
    render(rowWith({ move, begin: () => undefined, end }))

    grab()
    fireEvent.pointerCancel(window, { pointerId: 1 })
    dragTo(85)

    expect(end).toHaveBeenCalledTimes(1)
    expect(move).not.toHaveBeenCalled()
  })

  // Between two ranks the stack does not move, and nothing else would say a drag is under way.
  it('reads as held for the length of the gesture, and only for that', () => {
    render(rowWith({ move: (by: number) => by }))
    const row = screen.getByText('A1').closest('div[style]')

    grab()
    expect(row?.className).toContain('opacity-40')

    drop()
    expect(row?.className).not.toContain('opacity-40')
  })

  it('offers no grip to a row that holds no order of its own', () => {
    render(
      <TimelineRow height={ROW_HEIGHT} nested>
        <span>position</span>
      </TimelineRow>,
    )

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

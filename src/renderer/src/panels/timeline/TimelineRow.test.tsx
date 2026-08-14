import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { reorderSteps, TimelineRow } from './TimelineRow'

const ROW_HEIGHT = 40

/** jsdom has no pointer capture; the grip asks for one on every press. */
function capturable(element: Element): void {
  Object.assign(element, {
    setPointerCapture: (): void => undefined,
    releasePointerCapture: (): void => undefined,
  })
}

describe('reorderSteps', () => {
  it('counts a place travelled once the pointer is past the middle of the neighbour', () => {
    expect(reorderSteps(19, ROW_HEIGHT)).toBe(0)
    expect(reorderSteps(21, ROW_HEIGHT)).toBe(1)
    expect(reorderSteps(-21, ROW_HEIGHT)).toBe(-1)
    expect(reorderSteps(85, ROW_HEIGHT)).toBe(2)
  })
})

describe('TimelineRow', () => {
  const rowWith = (move: (by: number) => void) => (
    <TimelineRow height={ROW_HEIGHT} reorder={{ label: 'Déplacer la ligne', move }}>
      <span>A1</span>
    </TimelineRow>
  )

  it('moves the row by what the drag has travelled, and only by the difference', () => {
    const move = vi.fn()
    render(rowWith(move))

    const grip = screen.getByRole('button', { name: /Déplacer la ligne/ })
    capturable(grip)

    fireEvent.pointerDown(grip, { clientY: 0 })
    fireEvent.pointerMove(grip, { clientY: 45 })
    fireEvent.pointerMove(grip, { clientY: 85 })

    // One place, then one more — never "one, then two", which would send the row twice as far
    // as the pointer went.
    expect(move.mock.calls).toEqual([[1], [1]])
  })

  it('leaves the row where it is while the pointer stays inside its own height', () => {
    const move = vi.fn()
    render(rowWith(move))

    const grip = screen.getByRole('button', { name: /Déplacer la ligne/ })
    capturable(grip)

    fireEvent.pointerDown(grip, { clientY: 0 })
    fireEvent.pointerMove(grip, { clientY: 15 })

    expect(move).not.toHaveBeenCalled()
  })

  it('moves the row from the keyboard, so reordering is not a mouse-only gesture', async () => {
    const move = vi.fn()
    render(rowWith(move))

    const grip = screen.getByRole('button', { name: /Déplacer la ligne/ })
    grip.focus()
    await userEvent.keyboard('{ArrowUp}{ArrowDown}')

    expect(move.mock.calls).toEqual([[-1], [1]])
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

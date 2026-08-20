import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { usePointerDrag } from './usePointerDrag'

function Pad({ onTravel }: { onTravel: (travelled: number) => void }) {
  const drag = usePointerDrag<{ from: number }>()

  return (
    <div
      data-testid="pad"
      onPointerDown={event => drag.start(event, { from: event.clientX })}
      onPointerMove={event => {
        const current = drag.matching(event)
        if (current) onTravel(event.clientX - current.from)
      }}
      onPointerUp={event => {
        drag.end(event)
      }}
    />
  )
}

function pad(onTravel = vi.fn()) {
  render(<Pad onTravel={onTravel} />)
  return { onTravel, element: screen.getByTestId('pad') }
}

describe('usePointerDrag', () => {
  it('measures a move against where the drag began', () => {
    const { onTravel, element } = pad()

    fireEvent.pointerDown(element, { pointerId: 1, clientX: 10 })
    fireEvent.pointerMove(element, { pointerId: 1, clientX: 35 })

    expect(onTravel).toHaveBeenCalledWith(25)
  })

  /**
   * A mouse has no implicit capture, so a move with the button held from elsewhere reaches the
   * handler too — and answering it would resize or scrub from an origin that is not this gesture's.
   */
  it('ignores a move belonging to another pointer', () => {
    const { onTravel, element } = pad()

    fireEvent.pointerDown(element, { pointerId: 1, clientX: 10 })
    fireEvent.pointerMove(element, { pointerId: 2, clientX: 35 })

    expect(onTravel).not.toHaveBeenCalled()
  })

  it('stops answering once the drag has ended', () => {
    const { onTravel, element } = pad()

    fireEvent.pointerDown(element, { pointerId: 1, clientX: 10 })
    fireEvent.pointerUp(element, { pointerId: 1 })
    fireEvent.pointerMove(element, { pointerId: 1, clientX: 35 })

    expect(onTravel).not.toHaveBeenCalled()
  })
})

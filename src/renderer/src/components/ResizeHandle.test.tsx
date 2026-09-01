import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ResizeHandle } from './ResizeHandle'

const onSize = vi.fn()

/** jsdom implements neither pointer capture nor layout: the first is stubbed, the second given. */
beforeEach(() => {
  Element.prototype.setPointerCapture = vi.fn()
  onSize.mockClear()
})

function pair(size?: number) {
  const { container } = render(
    <div>
      <div data-testid="lead" />
      <ResizeHandle axis="vertical" invert size={size} onSize={onSize} />
      <div data-testid="trail" />
    </div>,
  )

  // jsdom lays nothing out, so both numbers the handle reads are given to it here.
  Object.defineProperty(screen.getByTestId('trail'), 'clientHeight', { value: 300 })
  Object.defineProperty(container.firstElementChild, 'clientHeight', { value: 900 })
}

function drag(by: number): void {
  const handle = screen.getByRole('separator')
  fireEvent.pointerDown(handle, { pointerId: 1, clientY: 500 })
  fireEvent.pointerMove(handle, { pointerId: 1, clientY: 500 - by })
}

describe('a handle nobody has dragged yet', () => {
  /** Starting from a constant would jump the panel to that constant on the first pixel. */
  it('starts the gesture from the panel it borders', () => {
    pair()
    drag(40)

    expect(onSize).toHaveBeenLastCalledWith(340, 900)
  })

  it('starts from the size it is given, once there is one', () => {
    pair(120)
    drag(40)

    expect(onSize).toHaveBeenLastCalledWith(160, 900)
  })
})

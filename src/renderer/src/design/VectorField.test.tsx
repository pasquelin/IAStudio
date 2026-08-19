import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { VectorField } from './VectorField'

function renderField(props: { scId?: string } = {}) {
  const onChange = vi.fn()
  const onGestureStart = vi.fn()
  const onGestureEnd = vi.fn()

  render(
    <VectorField
      label="Position"
      value={{ x: 1, y: 2, z: 3 }}
      step={1}
      onChange={onChange}
      onGestureStart={onGestureStart}
      onGestureEnd={onGestureEnd}
      {...props}
    />,
  )

  return { onChange, onGestureStart, onGestureEnd }
}

describe('VectorField', () => {
  it('shows one field per axis', () => {
    renderField()

    expect(screen.getByLabelText('X')).toHaveValue('1')
    expect(screen.getByLabelText('Y')).toHaveValue('2')
    expect(screen.getByLabelText('Z')).toHaveValue('3')
  })

  it('reports the whole vector when one axis moves', () => {
    const { onChange } = renderField()

    fireEvent.change(screen.getByLabelText('Y'), { target: { value: '9' } })

    expect(onChange).toHaveBeenCalledWith({ x: 1, y: 9, z: 3 })
  })

  // Each axis drags on its own letter: it is the gesture of every 3D application.
  it('drags one axis without touching the others', () => {
    const { onChange } = renderField()
    const handle = screen.getByText('Z')

    fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 0 })
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 4 })

    expect(onChange).toHaveBeenLastCalledWith({ x: 1, y: 2, z: 7 })
  })

  it('reports the gesture of whichever axis is dragged', () => {
    const { onGestureStart, onGestureEnd } = renderField()
    const handle = screen.getByText('X')

    fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 0 })
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 10 })
    fireEvent.pointerUp(handle, { pointerId: 1 })

    expect(onGestureStart).toHaveBeenCalledTimes(1)
    expect(onGestureEnd).toHaveBeenCalledTimes(1)
  })

  /** A tiling has two components, and a field built for it would have been this one, less a line. */
  describe('on a value of two axes', () => {
    const renderPair = () => {
      const onChange = vi.fn()
      render(<VectorField label="Tiling" value={{ x: 2, y: 3 }} step={1} onChange={onChange} />)
      return { onChange }
    }

    it('shows only the axes the value has', () => {
      renderPair()

      expect(screen.getByLabelText('X')).toHaveValue('2')
      expect(screen.getByLabelText('Y')).toHaveValue('3')
      expect(screen.queryByLabelText('Z')).toBeNull()
    })

    it('reports both components when one moves', () => {
      const { onChange } = renderPair()

      fireEvent.change(screen.getByLabelText('X'), { target: { value: '5' } })

      expect(onChange).toHaveBeenCalledWith({ x: 5, y: 3 })
    })
  })

  /**
   * The reading every 3D application gives the axes, and what lets a Position row be scanned
   * without reading the letters. They stay all the same: colour may not identify a thing on its
   * own (WCAG 1.4.1), and the letter is what carries the scrub and the accessible name.
   */
  it('stripes each field in the colour of its axis', () => {
    renderField()

    expect(screen.getByLabelText('X')).toHaveClass('border-l-axis-x')
    expect(screen.getByLabelText('Y')).toHaveClass('border-l-axis-y')
    expect(screen.getByLabelText('Z')).toHaveClass('border-l-axis-z')
  })

  // One handle per axis, so a script can name the very field it means.
  it('extends its own handle with the letter of each axis', () => {
    renderField({ scId: 'transform.position' })

    expect(screen.getByLabelText('X')).toHaveAttribute('data-sc', 'field:transform.position.x')
  })
})

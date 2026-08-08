import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { VectorField } from './VectorField'

function renderField() {
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

    it('shows the axes it is told to, in the order it is told', () => {
      const onChange = vi.fn()
      render(
        <VectorField
          label="Repeat"
          value={{ u: 1, v: 4 }}
          axes={['v', 'u']}
          step={1}
          onChange={onChange}
        />,
      )

      const labels = screen.getAllByText(/^[UV]$/).map(node => node.textContent)
      expect(labels).toEqual(['V', 'U'])
    })
  })
})

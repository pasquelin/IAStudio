import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Vector3Field } from './Vector3Field'

function renderField() {
  const onChange = vi.fn()
  const onGestureStart = vi.fn()
  const onGestureEnd = vi.fn()

  render(
    <Vector3Field
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

describe('Vector3Field', () => {
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
})

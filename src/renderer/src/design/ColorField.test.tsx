import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ColorField } from './ColorField'

function renderField(value = '#3574f0') {
  const onChange = vi.fn()
  const onGestureStart = vi.fn()
  const onGestureEnd = vi.fn()

  render(
    <ColorField
      label="Colour"
      value={value}
      onChange={onChange}
      onGestureStart={onGestureStart}
      onGestureEnd={onGestureEnd}
    />,
  )

  return { onChange, onGestureStart, onGestureEnd, swatch: screen.getByLabelText('Colour') }
}

describe('ColorField', () => {
  it('shows the colour it holds, and its hexadecimal', () => {
    const { swatch } = renderField('#ff0000')

    expect(swatch).toHaveValue('#ff0000')
    expect(screen.getByText('#ff0000')).toBeInTheDocument()
  })

  it('reports the colour that was picked', () => {
    const { onChange, swatch } = renderField()

    fireEvent.change(swatch, { target: { value: '#00ff00' } })

    expect(onChange).toHaveBeenCalledWith('#00ff00')
  })

  // The OS picker stays open and reports every colour the pointer passes over.
  it('makes the whole trip through the picker one gesture', () => {
    const { onGestureStart, onGestureEnd, swatch } = renderField()

    fireEvent.pointerDown(swatch)
    fireEvent.change(swatch, { target: { value: '#111111' } })
    fireEvent.change(swatch, { target: { value: '#222222' } })
    fireEvent.blur(swatch)

    expect(onGestureStart).toHaveBeenCalledTimes(1)
    expect(onGestureEnd).toHaveBeenCalledTimes(1)
  })
})

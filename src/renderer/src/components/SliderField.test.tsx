import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SliderField } from './SliderField'

function renderField(value = 0.5) {
  const onChange = vi.fn()
  const onGestureStart = vi.fn()
  const onGestureEnd = vi.fn()

  render(
    <SliderField
      label="Roughness"
      value={value}
      min={0}
      max={1}
      step={0.01}
      onChange={onChange}
      onGestureStart={onGestureStart}
      onGestureEnd={onGestureEnd}
    />,
  )

  return { onChange, onGestureStart, onGestureEnd, slider: screen.getByLabelText('Roughness') }
}

describe('SliderField', () => {
  it('shows the value beside the slider, so it can be read as a number', () => {
    renderField(0.25)

    expect(screen.getByText('0,25')).toBeInTheDocument()
  })

  it('reports where the slider was moved to', () => {
    const { onChange, slider } = renderField()

    fireEvent.change(slider, { target: { value: '0.8' } })

    expect(onChange).toHaveBeenCalledWith(0.8)
  })

  it('holds a value pushed past its range at the bound', () => {
    const { onChange, slider } = renderField()

    fireEvent.change(slider, { target: { value: '4' } })

    expect(onChange).toHaveBeenCalledWith(1)
  })

  it('reports a drag as one gesture', () => {
    const { onGestureStart, onGestureEnd, slider } = renderField()

    fireEvent.pointerDown(slider)
    fireEvent.change(slider, { target: { value: '0.6' } })
    fireEvent.change(slider, { target: { value: '0.7' } })
    fireEvent.pointerUp(slider)

    expect(onGestureStart).toHaveBeenCalledTimes(1)
    expect(onGestureEnd).toHaveBeenCalledTimes(1)
  })
})

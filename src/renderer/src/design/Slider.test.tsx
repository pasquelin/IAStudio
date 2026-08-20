import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Slider } from './Slider'

function renderSlider(value = 5) {
  const onChange = vi.fn()
  const onGestureStart = vi.fn()
  const onGestureEnd = vi.fn()

  const { container } = render(
    <Slider
      value={value}
      min={0}
      max={10}
      step={1}
      onChange={onChange}
      onGestureStart={onGestureStart}
      onGestureEnd={onGestureEnd}
    />,
  )

  return {
    onChange,
    onGestureStart,
    onGestureEnd,
    slider: screen.getByRole('slider'),
    // The span of the rail that is filled — the only node of the control carrying a style.
    filled: container.querySelector('[style]'),
  }
}

describe('Slider', () => {
  it('reports where the handle was moved to', () => {
    const { onChange, slider } = renderSlider()

    fireEvent.change(slider, { target: { value: '8' } })

    expect(onChange).toHaveBeenCalledWith(8)
  })

  it('fills the rail up to the value, so the control reads at a glance', () => {
    expect(renderSlider(2.5).filled).toHaveStyle({ left: '0%', width: '25%' })
  })

  it('reports a drag as one gesture', () => {
    const { onGestureStart, onGestureEnd, slider } = renderSlider()

    fireEvent.pointerDown(slider)
    fireEvent.change(slider, { target: { value: '6' } })
    fireEvent.change(slider, { target: { value: '7' } })
    fireEvent.pointerUp(slider)

    expect(onGestureStart).toHaveBeenCalledTimes(1)
    expect(onGestureEnd).toHaveBeenCalledTimes(1)
  })
})

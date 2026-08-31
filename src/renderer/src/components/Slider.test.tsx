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

  /**
   * A drag leaves the handle FOCUSED, and the blur lands later — on the next press somewhere else.
   * A gesture is keyed by document, so that second end closed whatever gesture had just been
   * opened, and every frame of the drag after it became an undo entry of its own.
   */
  it('ends the drag once, however long the handle keeps the focus', () => {
    const { onGestureStart, onGestureEnd, slider } = renderSlider()

    fireEvent.pointerDown(slider)
    fireEvent.focus(slider)
    fireEvent.change(slider, { target: { value: '6' } })
    fireEvent.pointerUp(slider)
    fireEvent.blur(slider)

    expect(onGestureStart).toHaveBeenCalledTimes(1)
    expect(onGestureEnd).toHaveBeenCalledTimes(1)
  })

  /**
   * Tab is not a step: it MOVES THE FOCUS on the keydown, so the keyup lands on the next control
   * and never comes back here. A gesture opened on it stays open for the life of the document, and
   * every later command folds into one undo entry.
   */
  it('opens no gesture on a key that only moves the focus', () => {
    const { onGestureStart, onGestureEnd, slider } = renderSlider()

    fireEvent.keyDown(slider, { key: 'Tab' })

    expect(onGestureStart).not.toHaveBeenCalled()
    expect(onGestureEnd).not.toHaveBeenCalled()
  })

  /**
   * A held arrow repeats, and `beginGesture` is not a counter: each repeat would rearm the merge
   * target, so a two-second press became one undo entry per repeat instead of one for the run.
   */
  it('opens one gesture for a held arrow, not one per repeat', () => {
    const { onGestureStart, slider } = renderSlider()

    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    fireEvent.keyDown(slider, { key: 'ArrowRight', repeat: true })
    fireEvent.keyDown(slider, { key: 'ArrowRight', repeat: true })

    expect(onGestureStart).toHaveBeenCalledTimes(1)
  })

  /** The arrows report the same way a drag does — the value moves, so the gesture is real. */
  it('reports a keyboard step as its own gesture', () => {
    const { onGestureStart, onGestureEnd, slider } = renderSlider()

    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    fireEvent.change(slider, { target: { value: '6' } })
    fireEvent.keyUp(slider, { key: 'ArrowRight' })

    expect(onGestureStart).toHaveBeenCalledTimes(1)
    expect(onGestureEnd).toHaveBeenCalledTimes(1)
  })
})

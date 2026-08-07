import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { NumberField } from './NumberField'

/**
 * The field is controlled, so a test that pins `value` never sees the second keystroke of a
 * number: the guard against re-emitting an unchanged value would swallow it, exactly as it
 * refuses to re-emit during a drag.
 */
function Controlled({
  onChange,
  ...props
}: Partial<Parameters<typeof NumberField>[0]> & { onChange: (value: number) => void }) {
  const [value, setValue] = useState(props.value ?? 1)

  return (
    <NumberField
      label="Radius"
      {...props}
      value={value}
      onChange={next => {
        setValue(next)
        onChange(next)
      }}
    />
  )
}

function renderField(props: Partial<Parameters<typeof NumberField>[0]> = {}) {
  const onChange = vi.fn()
  const onGestureStart = vi.fn()
  const onGestureEnd = vi.fn()

  render(
    <NumberField
      label="Radius"
      value={1}
      onChange={onChange}
      onGestureStart={onGestureStart}
      onGestureEnd={onGestureEnd}
      {...props}
    />,
  )

  return { onChange, onGestureStart, onGestureEnd, handle: screen.getByText('Radius') }
}

describe('NumberField', () => {
  it('shows the value it was given', () => {
    renderField({ value: 2.5 })

    expect(screen.getByLabelText('Radius')).toHaveValue('2.5')
  })

  describe('arrow keys', () => {
    it('steps the value up and down', async () => {
      const { onChange } = renderField({ value: 1, step: 0.5 })

      await userEvent.type(screen.getByLabelText('Radius'), '{ArrowUp}')
      expect(onChange).toHaveBeenLastCalledWith(1.5)

      await userEvent.type(screen.getByLabelText('Radius'), '{ArrowDown}')
      expect(onChange).toHaveBeenLastCalledWith(0.5)
    })

    // Nothing to report when the value cannot go further: an unchanged value is not an edit.
    it('stops at the bound', async () => {
      const onChange = vi.fn()
      render(<Controlled value={1} min={0} max={1} step={0.1} onChange={onChange} />)

      await userEvent.type(screen.getByLabelText('Radius'), '{ArrowUp}')

      expect(onChange).not.toHaveBeenCalled()
      expect(screen.getByLabelText('Radius')).toHaveValue('1')
    })
  })

  it('reports what is typed into it', async () => {
    const { onChange } = renderField({ value: 1 })

    await userEvent.clear(screen.getByLabelText('Radius'))
    await userEvent.type(screen.getByLabelText('Radius'), '7')

    expect(onChange).toHaveBeenLastCalledWith(7)
  })

  // `Number('')` is 0: emitting it would crush the mesh to its minimum in the moment between
  // clearing a field and typing the new value into it.
  it('says nothing while the field stands empty', async () => {
    const { onChange } = renderField({ value: 4, min: 0.001, step: 0.1 })

    await userEvent.clear(screen.getByLabelText('Radius'))

    expect(onChange).not.toHaveBeenCalled()
  })

  // "0." parses to 0, and echoing that back would swallow the dot as it is typed.
  it('leaves a half-written number in the field', async () => {
    renderField({ value: 1 })
    const field = screen.getByLabelText('Radius')

    await userEvent.clear(field)
    await userEvent.type(field, '0.')

    expect(field).toHaveDisplayValue('0.')
  })

  it('holds the value inside its bounds', async () => {
    const onChange = vi.fn()
    render(<Controlled value={0} min={0} max={1} onChange={onChange} />)

    await userEvent.clear(screen.getByLabelText('Radius'))
    await userEvent.type(screen.getByLabelText('Radius'), '5')

    expect(onChange).toHaveBeenLastCalledWith(1)
  })

  // A drag crosses many pixels per step, and a vertical one crosses none: each of those frames
  // would otherwise rebuild the geometry and re-render the panel for an identical value.
  it('says nothing when the value has not moved', () => {
    const { onChange, handle } = renderField({ value: 0, step: 1 })

    fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 0 })
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 0 })

    expect(onChange).not.toHaveBeenCalled()
  })

  it('snaps what is typed to the step', async () => {
    const { onChange } = renderField({ value: 1, step: 0.1 })

    await userEvent.clear(screen.getByLabelText('Radius'))
    await userEvent.type(screen.getByLabelText('Radius'), '0.44')

    expect(onChange).toHaveBeenLastCalledWith(0.4)
  })

  it('makes a whole typing session one gesture', async () => {
    const { onGestureStart, onGestureEnd } = renderField()

    await userEvent.click(screen.getByLabelText('Radius'))
    await userEvent.type(screen.getByLabelText('Radius'), '12')
    await userEvent.tab()

    expect(onGestureStart).toHaveBeenCalledTimes(1)
    expect(onGestureEnd).toHaveBeenCalledTimes(1)
  })

  describe('dragging the label', () => {
    it('moves the value sideways', () => {
      const { onChange, handle } = renderField({ value: 1, step: 0.1 })

      fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 100 })
      fireEvent.pointerMove(handle, { pointerId: 1, clientX: 110 })

      expect(onChange).toHaveBeenLastCalledWith(2)
    })

    // Accumulating deltas drifts: each one comes back snapped to the step.
    it('measures from where the drag began, not from the last value', () => {
      const { onChange, handle } = renderField({ value: 0, step: 1 })

      fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 0 })
      fireEvent.pointerMove(handle, { pointerId: 1, clientX: 3 })
      fireEvent.pointerMove(handle, { pointerId: 1, clientX: 5 })

      expect(onChange).toHaveBeenLastCalledWith(5)
    })

    it('reports the drag as one gesture', () => {
      const { onGestureStart, onGestureEnd, handle } = renderField()

      fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 0 })
      fireEvent.pointerMove(handle, { pointerId: 1, clientX: 20 })
      fireEvent.pointerMove(handle, { pointerId: 1, clientX: 40 })
      fireEvent.pointerUp(handle, { pointerId: 1 })

      expect(onGestureStart).toHaveBeenCalledTimes(1)
      expect(onGestureEnd).toHaveBeenCalledTimes(1)
    })

    it('emits nothing once the pointer is up', () => {
      const { onChange, handle } = renderField({ value: 0, step: 1 })

      fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 0 })
      fireEvent.pointerUp(handle, { pointerId: 1 })
      fireEvent.pointerMove(handle, { pointerId: 1, clientX: 50 })

      expect(onChange).not.toHaveBeenCalled()
    })

    it('ignores a drag started with the right button', () => {
      const { onChange, onGestureStart, handle } = renderField({ value: 0, step: 1 })

      fireEvent.pointerDown(handle, { button: 2, pointerId: 1, clientX: 0 })
      fireEvent.pointerMove(handle, { pointerId: 1, clientX: 30 })

      expect(onGestureStart).not.toHaveBeenCalled()
      expect(onChange).not.toHaveBeenCalled()
    })

    it('keeps the dragged value inside its bounds', () => {
      const { onChange, handle } = renderField({ value: 0.5, min: 0, max: 1, step: 0.01 })

      fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 0 })
      fireEvent.pointerMove(handle, { pointerId: 1, clientX: 500 })

      expect(onChange).toHaveBeenLastCalledWith(1)
    })

    it('emits once for a drag that crosses the same step twice', () => {
      const { onChange, handle } = renderField({ value: 0, step: 1 })

      fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 0 })
      fireEvent.pointerMove(handle, { pointerId: 1, clientX: 2 })
      fireEvent.pointerMove(handle, { pointerId: 1, clientX: 2 })

      expect(onChange).toHaveBeenCalledTimes(1)
    })
  })
})

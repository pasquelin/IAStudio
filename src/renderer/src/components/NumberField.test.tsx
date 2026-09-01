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
  // In the reader's own separator, like the readout beside it: the two sit in the same panel.
  it('shows the value it was given, written the way this reader writes one', () => {
    renderField({ value: 2.5 })

    expect(screen.getByLabelText('Radius')).toHaveValue('2,5')
  })

  // `String(-0)` was `'0'`; `Intl` writes the sign out. A step landing on zero from below is the
  // ordinary way to get one.
  it('never shows a negative zero', () => {
    renderField({ value: -0 })

    expect(screen.getByLabelText('Radius')).toHaveValue('0')
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

  /**
   * The decimal key of a French numeric pad produces a comma, so `0,5` is what a hand types by
   * default rather than by preference. `Number` read it as `NaN`, the field refuses non-finite
   * values, and the gesture failed in silence: the old value came back on blur.
   */
  it('takes the separator the keyboard puts under the thumb', async () => {
    const { onChange } = renderField({ value: 1, min: 0, step: 0.1 })

    await userEvent.clear(screen.getByLabelText('Radius'))
    await userEvent.type(screen.getByLabelText('Radius'), '0,5')

    expect(onChange).toHaveBeenLastCalledWith(0.5)
  })

  /**
   * Not a proof of the fix — it passed before it too, since `Number` reads a dot. It is here so
   * that taking the comma never costs the point.
   */
  it('takes the other one just as well', async () => {
    const { onChange } = renderField({ value: 1, min: 0, step: 0.1 })

    await userEvent.clear(screen.getByLabelText('Radius'))
    await userEvent.type(screen.getByLabelText('Radius'), '0.5')

    expect(onChange).toHaveBeenLastCalledWith(0.5)
  })

  /**
   * The visible half of the change, and the one a hand notices: a value typed with a dot comes
   * back written with a comma once the field is left. The number never moved — only its spelling.
   */
  it("rewrites what was typed in the reader's own separator once the field is left", async () => {
    render(<Controlled value={1} min={0} step={0.05} onChange={vi.fn()} />)
    const field = screen.getByLabelText('Radius')

    await userEvent.clear(field)
    await userEvent.type(field, '2.25')
    expect(field).toHaveDisplayValue('2.25')

    await userEvent.tab()

    expect(field).toHaveDisplayValue('2,25')
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

  /**
   * The same gesture on the field itself, which is where Unreal puts it. One control serves both
   * because the press is arbitrated by how far it travels, and the whole difficulty is that the
   * two answers are opposite: a click must end in edit mode, a drag must not.
   */
  describe('dragging the field', () => {
    /**
     * Counted from where the SLACK was crossed, not from the press: the crossing itself moves
     * nothing. Measured the other way, the first value emitted was `from + 4 × step` — a jump of
     * 0.4 on a position axis the instant the drag was recognised, which the label drag, having no
     * slack, never had.
     */
    it('moves the value sideways once the press has travelled', () => {
      const { onChange } = renderField({ value: 1, step: 0.1 })
      const field = screen.getByLabelText('Radius')

      fireEvent.pointerDown(field, { button: 0, pointerId: 1, clientX: 100 })
      fireEvent.pointerMove(field, { pointerId: 1, clientX: 110 })
      expect(onChange).not.toHaveBeenCalled()

      fireEvent.pointerMove(field, { pointerId: 1, clientX: 120 })
      expect(onChange).toHaveBeenLastCalledWith(2)
    })

    it('leaves the value alone while the press is still short of a drag', () => {
      const { onChange, onGestureStart } = renderField({ value: 1, step: 0.1 })
      const field = screen.getByLabelText('Radius')

      fireEvent.pointerDown(field, { button: 0, pointerId: 1, clientX: 100 })
      fireEvent.pointerMove(field, { pointerId: 1, clientX: 102 })

      expect(onChange).not.toHaveBeenCalled()
      expect(onGestureStart).not.toHaveBeenCalled()
    })

    it('puts the caret in when the press turns out to have been a click', () => {
      renderField()
      const field = screen.getByLabelText('Radius')

      fireEvent.pointerDown(field, { button: 0, pointerId: 1, clientX: 100 })
      fireEvent.pointerUp(field, { pointerId: 1, clientX: 100 })

      expect(field).toHaveFocus()
    })

    // Leaving the field in edit mode after a drag is what made the two gestures fight over it.
    it('leaves the field unfocused after a drag', () => {
      renderField({ value: 1, step: 0.1 })
      const field = screen.getByLabelText('Radius')

      fireEvent.pointerDown(field, { button: 0, pointerId: 1, clientX: 100 })
      fireEvent.pointerMove(field, { pointerId: 1, clientX: 140 })
      fireEvent.pointerUp(field, { pointerId: 1, clientX: 140 })

      expect(field).not.toHaveFocus()
    })

    /** With a caret in the field a press is a press on TEXT: selecting a digit must not scrub. */
    it('does not scrub a field that is being typed in', () => {
      const { onChange } = renderField({ value: 1, step: 0.1 })
      const field = screen.getByLabelText('Radius')
      field.focus()

      fireEvent.pointerDown(field, { button: 0, pointerId: 1, clientX: 100 })
      fireEvent.pointerMove(field, { pointerId: 1, clientX: 140 })

      expect(onChange).not.toHaveBeenCalled()
    })

    /** Shift covers ten steps per pixel — the coarse pass over a range a step alone crawls. */
    it('drags ten times as far while Shift is held', () => {
      const { onChange } = renderField({ value: 1, step: 0.1 })
      const field = screen.getByLabelText('Radius')

      fireEvent.pointerDown(field, { button: 0, pointerId: 1, clientX: 100, shiftKey: true })
      // The first move only crosses the slack; the second is the one that travels.
      fireEvent.pointerMove(field, { pointerId: 1, clientX: 110, shiftKey: true })
      fireEvent.pointerMove(field, { pointerId: 1, clientX: 120, shiftKey: true })

      // Ten pixels at ten steps each, where the same drag unmodified moves one.
      expect(onChange).toHaveBeenLastCalledWith(11)
    })

    /**
     * Rebased where the modifier CHANGES, for the reason the slack is: read off the whole travel,
     * the new rate would move the value ten steps for every one already dragged — 1 would leap to
     * 11 on the press of a key that moved the pointer not at all.
     */
    it('does not jump when Shift is taken mid-drag', () => {
      const { onChange } = renderField({ value: 1, step: 0.1 })
      const field = screen.getByLabelText('Radius')

      fireEvent.pointerDown(field, { button: 0, pointerId: 1, clientX: 100 })
      fireEvent.pointerMove(field, { pointerId: 1, clientX: 110 })
      fireEvent.pointerMove(field, { pointerId: 1, clientX: 120 })
      expect(onChange).toHaveBeenLastCalledWith(2)

      fireEvent.pointerMove(field, { pointerId: 1, clientX: 120, shiftKey: true })
      expect(onChange).toHaveBeenLastCalledWith(2)

      fireEvent.pointerMove(field, { pointerId: 1, clientX: 130, shiftKey: true })

      expect(onChange).toHaveBeenLastCalledWith(12)
    })

    /**
     * The right button starts nothing, so the press must not be swallowed either: it used to be,
     * and the release then read as a click and focused the field — a gesture the press declined.
     */
    it('leaves a right press to the platform, field and all', () => {
      const { onChange } = renderField({ value: 1, step: 0.1 })
      const field = screen.getByLabelText('Radius')

      const press = fireEvent.pointerDown(field, { button: 2, pointerId: 1, clientX: 100 })
      fireEvent.pointerUp(field, { button: 2, pointerId: 1, clientX: 100 })

      expect(press).toBe(true)
      expect(field).not.toHaveFocus()
      expect(onChange).not.toHaveBeenCalled()
    })

    // One history entry for the whole drag, opened where the scrub is, not where the press was.
    it('spans the drag with a single gesture', () => {
      const { onGestureStart, onGestureEnd } = renderField({ value: 1, step: 0.1 })
      const field = screen.getByLabelText('Radius')

      fireEvent.pointerDown(field, { button: 0, pointerId: 1, clientX: 100 })
      fireEvent.pointerMove(field, { pointerId: 1, clientX: 120 })
      fireEvent.pointerMove(field, { pointerId: 1, clientX: 140 })
      fireEvent.pointerUp(field, { pointerId: 1, clientX: 140 })

      expect(onGestureStart).toHaveBeenCalledTimes(1)
      expect(onGestureEnd).toHaveBeenCalledTimes(1)
    })
  })
})

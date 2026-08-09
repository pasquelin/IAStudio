import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RangeField, type RangeValue } from './RangeField'

function renderField(value: RangeValue = { min: 0.2, max: 0.8 }) {
  const onChange = vi.fn()
  const onGestureStart = vi.fn()
  const onGestureEnd = vi.fn()

  render(
    <RangeField
      label="Roughness"
      value={value}
      min={0}
      max={1}
      step={0.01}
      fromLabel="Roughness from"
      toLabel="Roughness to"
      onChange={onChange}
      onGestureStart={onGestureStart}
      onGestureEnd={onGestureEnd}
    />,
  )

  return {
    onChange,
    onGestureStart,
    onGestureEnd,
    from: screen.getByLabelText('Roughness from'),
    to: screen.getByLabelText('Roughness to'),
  }
}

describe('RangeField', () => {
  it('reads out both ends, so a span can be written down', () => {
    renderField({ min: 0.25, max: 0.75 })

    expect(screen.getByText('0.25–0.75')).toBeInTheDocument()
  })

  it('names each handle apart, which is all a screen reader has to tell them by', () => {
    const { from, to } = renderField()

    expect(from).toHaveValue('0.2')
    expect(to).toHaveValue('0.8')
  })

  it('moves one end and leaves the other where it was', () => {
    const { onChange, from } = renderField()

    fireEvent.change(from, { target: { value: '0.4' } })

    expect(onChange).toHaveBeenCalledWith({ min: 0.4, max: 0.8 })
  })

  it('moves the upper end on its own too', () => {
    const { onChange, to } = renderField()

    fireEvent.change(to, { target: { value: '0.9' } })

    expect(onChange).toHaveBeenCalledWith({ min: 0.2, max: 0.9 })
  })

  /** Meeting is legitimate — a span of nothing — so the clamp stops at the other handle. */
  it('stops the lower handle at the upper one rather than letting it past', () => {
    const { onChange, from } = renderField({ min: 0.2, max: 0.5 })

    fireEvent.change(from, { target: { value: '0.9' } })

    expect(onChange).toHaveBeenCalledWith({ min: 0.5, max: 0.5 })
  })

  it('stops the upper handle at the lower one, the same way round', () => {
    const { onChange, to } = renderField({ min: 0.4, max: 0.8 })

    fireEvent.change(to, { target: { value: '0.1' } })

    expect(onChange).toHaveBeenCalledWith({ min: 0.4, max: 0.4 })
  })

  it('holds a value pushed past the field itself at the bound', () => {
    const { onChange, to } = renderField()

    fireEvent.change(to, { target: { value: '4' } })

    expect(onChange).toHaveBeenCalledWith({ min: 0.2, max: 1 })
  })

  /**
   * Stacked inputs: the last in the DOM catches every press where they overlap. Both handles at
   * the ceiling is one drag away — `set('min')` clamps against `value.max` — and there «to» has
   * nowhere to drag to, so it cannot part them: «from» would stay buried for the session,
   * keyboard aside. Reproduced on screen before it was fixed.
   *
   * `classList`, not `toContain`: `className` is one string, so a `z-10` added later would
   * satisfy the positive assertion and break the negative one without anyone noticing.
   */
  it('lifts the lower handle once the upper one is against the ceiling', () => {
    const { from, to } = renderField({ min: 1, max: 1 })

    expect(from.classList.contains('z-1')).toBe(true)
    expect(to.classList.contains('z-1')).toBe(false)
  })

  /**
   * Anywhere below the ceiling the presses stay with «to», and that is the answer, not an
   * oversight: it still has room above to drag into, and one gesture parts the two. Lifting
   * «from» here would take that gesture away — the span could then only ever be narrowed,
   * since `set('min')` clamps against `value.max` and would move nothing.
   */
  it.each([
    ['at the floor', 0],
    ['halfway', 0.5],
    ['high but not against the ceiling', 0.7],
  ])('leaves the stacking alone with both handles %s', (_where, at) => {
    const { from, onChange, to } = renderField({ min: at, max: at })

    expect(from.classList.contains('z-1')).toBe(false)

    fireEvent.change(to, { target: { value: '0.95' } })
    expect(onChange).toHaveBeenCalledWith({ min: at, max: 0.95 })
  })

  it('reports a drag across the rail as one gesture', () => {
    const { onGestureStart, onGestureEnd, from } = renderField()

    fireEvent.pointerDown(from)
    fireEvent.change(from, { target: { value: '0.3' } })
    fireEvent.change(from, { target: { value: '0.4' } })
    fireEvent.pointerUp(from)

    expect(onGestureStart).toHaveBeenCalledTimes(1)
    expect(onGestureEnd).toHaveBeenCalledTimes(1)
  })
})

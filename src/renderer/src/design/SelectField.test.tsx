import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SelectField, type SelectOption } from './SelectField'

type Blend = 'normal' | 'multiply' | 'screen'

const BLENDS: readonly SelectOption<Blend>[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'screen', label: 'Screen' },
]

function renderField(props: Partial<Parameters<typeof SelectField<Blend>>[0]> = {}) {
  const onChange = vi.fn()

  render(
    <SelectField
      label="Blend mode"
      value="normal"
      options={BLENDS}
      onChange={onChange}
      {...props}
    />,
  )

  return { onChange, select: screen.getByRole('combobox') }
}

describe('SelectField', () => {
  it('offers every option it was given, under the value it holds', () => {
    const { select } = renderField({ value: 'multiply' })

    expect(select).toHaveValue('multiply')
    expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual([
      'Normal',
      'Multiply',
      'Screen',
    ])
  })

  it('reports the value that was chosen', () => {
    const { onChange, select } = renderField()

    fireEvent.change(select, { target: { value: 'screen' } })

    expect(onChange).toHaveBeenCalledWith('screen')
  })

  /**
   * The whole reason this component exists: a `<select>` answers with a string, and twenty-one
   * sites each read it back into their own union — three of them differently. A value no option
   * carries must never reach the document.
   */
  it('drops a value no option answers to, rather than reporting it', () => {
    const { onChange, select } = renderField()

    fireEvent.change(select, { target: { value: 'overlay' } })

    expect(onChange).not.toHaveBeenCalled()
  })

  it('names itself by its visible label, with no second name over it', () => {
    renderField()

    expect(screen.getByLabelText('Blend mode')).toBeInTheDocument()
    expect(screen.getByRole('combobox')).not.toHaveAttribute('aria-label')
  })

  // On a bar there is no label column to draw, so the name has nowhere to live but the attribute.
  it('keeps a name when it draws no label column', () => {
    renderField({ layout: 'inline' })

    expect(screen.queryByText('Blend mode')).not.toBeInTheDocument()
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-label', 'Blend mode')
  })

  it('wears the handle the MCP steers it by', () => {
    renderField({ scId: 'layer.blend' })

    expect(screen.getByRole('combobox')).toHaveAttribute('data-sc', 'field:layer.blend')
  })

  it('wears no handle when none was given, rather than an empty one', () => {
    renderField()

    expect(screen.getByRole('combobox')).not.toHaveAttribute('data-sc')
  })

  /**
   * The label BINDS the select rather than wrapping it, so what stands beside the control is not
   * swallowed by it: wrapped, pressing « add a rail » would open the list of rails next to it.
   */
  it('leaves what stands beside the select out of what the label names', () => {
    renderField({
      leading: <button type="button">Open</button>,
      actions: <button type="button">Add a rail</button>,
    })

    expect(screen.getByRole('button', { name: 'Open' }).closest('label')).toBeNull()
    expect(screen.getByRole('button', { name: 'Add a rail' }).closest('label')).toBeNull()
    // And the binding still holds, which is what makes the visible word the accessible name.
    expect(screen.getByLabelText('Blend mode')).toBe(screen.getByRole('combobox'))
  })
})
